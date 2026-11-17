import { compatibilityReport } from './compatibility.mjs';
console.log(JSON.stringify(await compatibilityReport(), null, 2));
