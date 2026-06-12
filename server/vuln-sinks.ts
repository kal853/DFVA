// ── SENTINEL CVE Sink Registry ────────────────────────────────────────────────
//
// Each function below calls the specific API identified as the vulnerable sink
// in the relevant CVE / GHSA advisory.  All functions are exported (named) so
// static call-graph analysis can enumerate them directly without needing to
// trace through HTTP handler dispatch logic.
//
// The registry is initialised at module load time by calling registerAllSinks()
// at the bottom of this file.  Importing this module is therefore sufficient to
// make every sink reachable.
//
// Inputs used here are intentionally benign; the purpose is reachability, not
// active exploitation.  The same functions are called with attacker-controlled
// input in the route handlers registered in server/routes.ts.
//

// @ts-ignore
import { DOMParser } from "xmldom";
// @ts-ignore
import { NodeVM } from "vm2";
// @ts-ignore
import pug from "pug";
// @ts-ignore
import * as flat from "flat";
import marked from "marked";
import _ from "lodash";

// ── xmldom@0.6.0 ─────────────────────────────────────────────────────────────
// CVE-2022-39353 / GHSA-crh6-fp67-6883 (Critical)
// Vulnerable sink: DOMParser.prototype.parseFromString
// Prototype pollution via crafted XML attribute names (__proto__, constructor).
export function xmldomParseFromString(xml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  return doc.documentElement?.tagName ?? "";
}

// CVE-2021-21366 / GHSA-5fg8-2547-mr8q (Medium)
// Vulnerable sink: DOMParser.prototype.parseFromString (DOCTYPE + ENTITY path)
// XXE via unblocked DOCTYPE declarations.
export function xmldomParseXXE(xml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  return doc.documentElement?.textContent ?? "";
}

// ── vm2@3.10.5 ───────────────────────────────────────────────────────────────
// CVE-2023-29017 / CVE-2023-37466 / GHSA-cchq-frgv-7wfd (Critical)
// Vulnerable sink: NodeVM.prototype.run
// Sandbox escape via prototype pollution inside the vm2 sandbox context.
export function vm2RunScript(code: string): unknown {
  const vm = new NodeVM({ sandbox: {}, require: { external: false } });
  return vm.run(`module.exports = (function(){ ${code} })()`);
}

// ── pug@2.0.4 ────────────────────────────────────────────────────────────────
// CVE-2021-21353 / GHSA-p493-635q-r6gr (Critical)
// Vulnerable sink: pug.render
// SSTI → RCE: attacker-controlled template executes arbitrary Node.js code.
export function pugRender(template: string, locals?: Record<string, unknown>): string {
  return pug.render(template, locals ?? {});
}

// ── flat@5.0.0 ───────────────────────────────────────────────────────────────
// CVE-2020-28168 / GHSA-2j2x-2gpw-g8fm (High)
// Vulnerable sink: flat.unflatten
// Prototype pollution: unflatten({"__proto__.x":"y"}) writes to Object.prototype.
export function flatUnflatten(obj: Record<string, unknown>): unknown {
  return (flat as any).unflatten(obj);
}

// Secondary sink: flat.flatten (input traversal path overlaps with prototype keys)
export function flatFlatten(obj: Record<string, unknown>): unknown {
  return (flat as any).flatten(obj);
}

// ── marked@0.3.6 ─────────────────────────────────────────────────────────────
// CVE-2022-21681 / CVE-2022-21680 / GHSA-5v2h-r2cx-5xgj (High)
// Vulnerable sink: marked (default export, calls Lexer + Parser internally)
// Unsanitised HTML passthrough → stored XSS when output rendered in browser.
export function markedRender(markdown: string): string {
  return marked(markdown) as string;
}

// ── lodash@4.17.15 ───────────────────────────────────────────────────────────
// CVE-2019-10744 / GHSA-p6mc-m468-83gw (Critical)
// Vulnerable sink: _.merge (and _.mergeWith, _.defaultsDeep, _.zipObjectDeep)
// Prototype pollution: _.merge({}, JSON.parse('{"__proto__":{"x":1}}'))
// writes x=1 to Object.prototype.
export function lodashMerge(target: object, source: object): object {
  return _.merge(target, source);
}

// ── Legacy preferences parsing ───────────────────────────────────────────────
// The preferences route previously used node-serialize@0.0.4 here, which could
// execute attacker-controlled code during deserialisation. Restrict parsing to
// strict JSON text so function markers are treated as plain strings or rejected.
export function nodeSerializeDeserialize(payload: string): unknown {
  return JSON.parse(payload);
}

// ── Sink registry ─────────────────────────────────────────────────────────────
// Called once at module load.  Each invocation uses a safe, non-exploiting
// input so the call appears in profiling / coverage data as well as in the
// static call graph.
export function registerAllSinks(): void {
  xmldomParseFromString("<sentinel-probe/>");
  xmldomParseXXE("<sentinel-probe/>");
  vm2RunScript("'sentinel-probe'");
  pugRender("| sentinel-probe");
  flatUnflatten({ "sentinel.probe": true });
  flatFlatten({ sentinel: { probe: true } });
  markedRender("sentinel-probe");
  lodashMerge({}, { sentinelProbe: true });
  nodeSerializeDeserialize('{"sentinelProbe":true}');
}

// Invoke immediately so every sink is enumerable from module load.
registerAllSinks();
