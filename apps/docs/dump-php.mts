import { getApiResources } from "@/lib/api-ref/model";
import { buildOperationSnippets } from "@/lib/api-ref/snippets";
import { sdkCall } from "@/lib/api-ref/sdk-map";

const res = getApiResources();
let n = 0;
for (const r of res) {
  for (const op of r.operations) {
    n++;
    const c = sdkCall(op);
    console.log(`----- [${n}] ${op.id}  => $nombaone->${c.namespace.join("->")}->${c.method}`);
    console.log(buildOperationSnippets(op).php);
  }
}
console.error("TOTAL OPS:", n);
