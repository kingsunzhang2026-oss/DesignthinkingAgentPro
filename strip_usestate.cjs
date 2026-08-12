const fs = require('fs');
const filePath = 'src/app/components/NodeCanvas.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldFuncStart = content.indexOf('  const [nodes, setNodes] = useState<NodeData[]>(');
const oldFuncEnd = content.indexOf('  const [zoom, setZoom] = useState(1);', oldFuncStart);

content = content.substring(0, oldFuncStart) + content.substring(oldFuncEnd);
fs.writeFileSync(filePath, content);
