import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createClient } from "@supabase/supabase-js";
import * as jose from "jose";
import * as kv from "./kv_store.ts";

const app = new Hono();

app.use('*', logger());
app.use('*', cors());

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

const JWKS = jose.createRemoteJWKSet(
    new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)
);

async function verifyUserToken(token: string) {
    if (!token) return { user: null, error: new Error("No token provided") };
    
    try {
        const { payload } = await jose.jwtVerify(token, JWKS, {
             issuer: `${supabaseUrl}/auth/v1`,
             audience: 'authenticated'
        });
        
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

app.post('/make-server-5590af4c/submit-record', async (c) => {
  try {
    const body = await c.req.json();
    const token = body.access_token;
    
    const { user, error } = await verifyUserToken(token);
    if (error || !user) return c.text(`Unauthorized`, 401);

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
        return c.text('Bad Request', 400);
    }

    const timestamp = Date.now();
    const batchId = crypto.randomUUID(); 
    
    const savePromises = sequences.map(async (seq: any) => {
        const submissionId = crypto.randomUUID();
        const key = `submission:${user.id}:${seq.scenarioId}:${timestamp}`;
        const record = { id: submissionId, batchId, userId: user.id, userEmail: user.email, scenarioId: seq.scenarioId, scenarioTitle: seq.scenarioTitle, tasks: seq.tasks, submittedAt: new Date().toISOString() };
        await kv.set(key, record);
    });

    await Promise.all(savePromises);

    const prefix = `submission:${user.id}:`;
    const allUserRecords = await kv.getByPrefix(prefix);
    return c.json({ success: true, savedCount: sequences.length, totalUserRecords: allUserRecords.length, batchId });

  } catch (err: any) {
    return c.text(`Server Error: ${err.message}`, 500);
  }
});

function jsonToCsv(records: any[]) {
  const headers = ['SubmissionID', 'User', 'Time', 'Scenario', 'TaskCode', 'TaskTitle', 'Metric', 'Value', 'Unit', 'Guidance'];
  const rows = [headers.join(',')];
  records.forEach(record => {
    if (!record.tasks) return;
    record.tasks.forEach((task: any) => {
      if (!task.recordPoints) return;
      task.recordPoints.forEach((rp: any) => {
        const safe = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;
        const row = [safe(record.id), safe(record.userEmail || record.userId), safe(record.submittedAt), safe(record.scenarioTitle), safe(task.code), safe(task.title), safe(rp.label), safe(rp.value), safe(rp.unit), safe(rp.guidance)];
        rows.push(row.join(','));
      });
    });
  });
  return rows.join('\n');
}

app.post('/make-server-5590af4c/export/my-records', async (c) => {
    try {
        const body = await c.req.json();
        const { user, error } = await verifyUserToken(body.access_token);
        if (error || !user) return c.text('Unauthorized', 401);

        const records = await kv.getByPrefix(`submission:${user.id}:`);
        return new Response(jsonToCsv(records.filter(r => r !== null)), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="my_records.csv"` }});
    } catch (err: any) {
        return c.text(`Error: ${err.message}`, 500);
    }
});

app.post('/make-server-5590af4c/export/all-records', async (c) => {
    try {
        const body = await c.req.json();
        const { user, error } = await verifyUserToken(body.access_token);
        if (error || !user) return c.text('Unauthorized', 401);

        const records = await kv.getByPrefix(`submission:`);
        return new Response(jsonToCsv(records.filter(r => r !== null)), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="all.csv"` }});
    } catch (err: any) {
        return c.text(`Error: ${err.message}`, 500);
    }
});

serve(app.fetch);
