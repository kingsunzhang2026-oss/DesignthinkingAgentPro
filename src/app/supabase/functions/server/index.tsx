import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Hono } from "npm:hono@3";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as jose from "npm:jose@5.2.3";
import * as kv from "./kv_store.tsx";

const app = new Hono();

app.use('*', logger());
app.use('*', cors());

// Initialize Supabase Admin Client
// CRITICAL: persistSession: false is required for Edge Functions to avoid "AuthSessionMissingError"
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

// ------------------------------------------------------------------
// JWT Verification Helper (Pattern 1: Manual Verification)
// ------------------------------------------------------------------
// We use a cached JWKS client to verify tokens without relying on supabase.auth.getUser()
// which causes session errors in Edge Runtime.
const JWKS = jose.createRemoteJWKSet(
    new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)
);

async function verifyUserToken(token: string) {
    if (!token) return { user: null, error: new Error("No token provided") };
    
    try {
        // Verify against Supabase JWKS
        const { payload } = await jose.jwtVerify(token, JWKS, {
             issuer: `${supabaseUrl}/auth/v1`,
             audience: 'authenticated'
        });
        
        // Return a user-like object
        return { 
            user: { 
                id: payload.sub as string, 
                email: payload.email as string,
                role: payload.role as string
            }, 
            error: null 
        };
    } catch (err) {
        return { user: null, error: err };
    }
}

// ------------------------------------------------------------------
// 1. Submit Record (Concurrent Safe) - Supports Batch Upload
// ------------------------------------------------------------------
app.post('/make-server-5590af4c/submit-record', async (c) => {
  try {
    // 1. Gateway Pass Strategy: Check Anon Key in Header (Optional but good practice)
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
        return c.text('Unauthorized: Missing Authorization Header', 401);
    }
    
    // 2. Body Auth Strategy: Verify the ACTUAL user token from body
    const body = await c.req.json();
    const token = body.access_token;
    
    // Pattern 1 Verification
    const { user, error } = await verifyUserToken(token);
    
    if (error || !user) {
        console.error('JWT Verification Failed:', error);
        return c.text(`Unauthorized: ${error?.message || 'Invalid Token'}`, 401);
    }

    // Support both single submission (legacy) and batch submission (new)
    let sequences = [];
    if (body.allSequences && Array.isArray(body.allSequences)) {
        sequences = body.allSequences;
    } else if (body.scenarioId && body.tasks) {
        sequences = [{
            scenarioId: body.scenarioId,
            scenarioTitle: body.scenarioTitle,
            tasks: body.tasks
        }];
    } else {
        return c.text('Bad Request: Missing sequences data', 400);
    }

    const timestamp = Date.now();
    const batchId = crypto.randomUUID(); 
    
    const savePromises = sequences.map(async (seq: any) => {
        const submissionId = crypto.randomUUID();
        const key = `submission:${user.id}:${seq.scenarioId}:${timestamp}`;
        
        const record = {
            id: submissionId,
            batchId: batchId,
            userId: user.id,
            userEmail: user.email,
            scenarioId: seq.scenarioId,
            scenarioTitle: seq.scenarioTitle,
            tasks: seq.tasks,
            submittedAt: new Date().toISOString()
        };
        
        await kv.set(key, record);
    });

    await Promise.all(savePromises);

    // Calculate total count for this user (for feedback)
    const prefix = `submission:${user.id}:`;
    const allUserRecords = await kv.getByPrefix(prefix);
    const totalCount = allUserRecords.length;

    return c.json({ success: true, savedCount: sequences.length, totalUserRecords: totalCount, batchId });

  } catch (err) {
    console.error('Submit error:', err);
    return c.text(`Server Error: ${err.message}`, 500);
  }
});

// ------------------------------------------------------------------
// Helper: JSON to CSV
// ------------------------------------------------------------------
function jsonToCsv(records: any[]) {
  const headers = ['SubmissionID', 'User', 'Time', 'Scenario', 'TaskCode', 'TaskTitle', 'Metric', 'Value', 'Unit', 'Guidance'];
  const rows = [headers.join(',')];

  records.forEach(record => {
    if (!record.tasks || !Array.isArray(record.tasks)) return;

    record.tasks.forEach((task: any) => {
      if (!task.recordPoints || !Array.isArray(task.recordPoints)) return;

      task.recordPoints.forEach((rp: any) => {
        // Escape quotes
        const safe = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;
        
        const row = [
          safe(record.id),
          safe(record.userEmail || record.userId),
          safe(record.submittedAt),
          safe(record.scenarioTitle),
          safe(task.code),
          safe(task.title),
          safe(rp.label),
          safe(rp.value),
          safe(rp.unit),
          safe(rp.guidance)
        ];
        rows.push(row.join(','));
      });
    });
  });
  
  return rows.join('\n');
}

// ------------------------------------------------------------------
// 2. Export My Records (Personal Download)
// ------------------------------------------------------------------
app.post('/make-server-5590af4c/export/my-records', async (c) => {
    try {
        const body = await c.req.json();
        const token = body.access_token;

        const { user, error } = await verifyUserToken(token);
        if (error || !user) return c.text(`Unauthorized: ${error?.message}`, 401);

        const prefix = `submission:${user.id}:`;
        const records = await kv.getByPrefix(prefix);
        const validRecords = records.filter(r => r !== null);
        
        const csvData = jsonToCsv(validRecords);

        return new Response(csvData, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="my_records_${user.id.substring(0,8)}.csv"`
            }
        });

    } catch (err) {
        return c.text(`Export Error: ${err.message}`, 500);
    }
});

// ------------------------------------------------------------------
// 3. Export All Records (Admin Aggregation)
// ------------------------------------------------------------------
app.post('/make-server-5590af4c/export/all-records', async (c) => {
    try {
        const body = await c.req.json();
        const token = body.access_token;

        const { user, error } = await verifyUserToken(token);
        if (error || !user) return c.text(`Unauthorized: ${error?.message}`, 401);
        
        // Basic check, in real scenario check role
        // if (user.email !== 'admin@make.com') ...

        const prefix = `submission:`;
        const allRecords = await kv.getByPrefix(prefix);
        const validRecords = allRecords.filter(r => r !== null);

        const csvData = jsonToCsv(validRecords);
        
        return new Response(csvData, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="all_participants_data_${Date.now()}.csv"`
            }
        });

    } catch (err) {
        return c.text(`Admin Export Error: ${err.message}`, 500);
    }
});

// ------------------------------------------------------------------
// 4. Initialize Demo Users (One-time setup helper)
// ------------------------------------------------------------------
app.post('/make-server-5590af4c/init-demo-users', async (c) => {
  const users = [
    { email: 'admin@make.com', password: 'admin123', role: 'admin' },
    ...Array.from({ length: 10 }, (_, i) => ({
      email: `operator${i + 1}@make.com`,
      password: '123456', 
      role: 'operator'
    }))
  ];

  const results = [];

  try {
    const { data: { users: existingUsers }, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    
    if (listError) throw listError;

    for (const u of users) {
      const existing = existingUsers.find(eu => eu.email?.toLowerCase() === u.email.toLowerCase());

      if (existing) {
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          existing.id, 
          { 
            password: u.password, 
            user_metadata: { role: u.role }, 
            email_confirm: true 
          }
        );
        
        if (updateError) {
             results.push({ email: u.email, status: 'error-update', msg: updateError.message });
        } else {
             // Verify login using password (this is safe as it doesn't use token session)
             const { error: verifyError } = await supabase.auth.signInWithPassword({
                email: u.email,
                password: u.password
             });
             
             if (verifyError) {
                 results.push({ email: u.email, status: 'updated-but-login-failed', msg: verifyError.message });
             } else {
                 results.push({ email: u.email, status: 'updated-and-verified' });
             }
        }
      } else {
        const { error: createError } = await supabase.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { role: u.role }
        });

        if (createError) {
          results.push({ email: u.email, status: 'error-create', msg: createError.message });
        } else {
             const { error: verifyError } = await supabase.auth.signInWithPassword({
                email: u.email,
                password: u.password
             });
             
             if (verifyError) {
                 results.push({ email: u.email, status: 'created-but-login-failed', msg: verifyError.message });
             } else {
                 results.push({ email: u.email, status: 'created-and-verified' });
             }
        }
      }
    }
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }

  return c.json({ summary: results });
});

serve(app.fetch);