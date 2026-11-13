/** Offline #406 research. Never imports a Host client, signer or chain transport. */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const hash = value => createHash('sha256').update(value).digest('hex');

export function inspectPaymentDeclarations(hostText, protocolText) {
  const parse = text => ts.createSourceFile('surface.d.ts', text, ts.ScriptTarget.Latest, true);
  const host = parse(hostText);
  const protocol = parse(protocolText);
  const named = (source, name) =>
    source.statements.find(node => node.name?.text === name && (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)));
  const members = node => (node && ts.isInterfaceDeclaration(node) ? node.members.map(member => member.name?.getText()) : []);
  const tags = name => {
    const node = named(protocol, name);
    if (!node || !ts.isTypeAliasDeclaration(node)) return [];
    const found = [];
    function visit(child) {
      if (
        ts.isPropertySignature(child) &&
        child.name.getText() === 'tag' &&
        child.type &&
        ts.isLiteralTypeNode(child.type) &&
        ts.isStringLiteral(child.type.literal)
      )
        found.push(child.type.literal.text);
      ts.forEachChild(child, visit);
    }
    visit(node);
    return found.sort();
  };
  const manager = named(host, 'PaymentManager');
  const request = manager?.members.find(member => member.name?.getText() === 'requestPayment');
  const protocolRequest = named(protocol, 'HostPaymentRequest');
  const requestFields = members(protocolRequest);
  const hasRequiredId = node =>
    Boolean(
      node &&
      ts.isInterfaceDeclaration(node) &&
      node.members.some(member => member.name?.getText() === 'id' && !member.questionToken && member.type?.getText() === 'HexString')
    );
  const protocolCallerChosenId = hasRequiredId(protocolRequest);
  const sdkCallerChosenId = Boolean(
    request?.parameters.length === 1 && request.parameters[0].type?.getText() === 'PaymentRequest' && hasRequiredId(named(host, 'PaymentRequest'))
  );
  return {
    requestParameterTypes: request?.parameters.map(parameter => parameter.type?.getText() ?? 'unknown') ?? [],
    callerChosenId: protocolCallerChosenId && sdkCallerChosenId,
    protocolCallerChosenId,
    sdkCallerChosenId,
    requestFields,
    statusTags: tags('HostPaymentStatusSubscribeItem'),
    requestErrorTags: tags('HostPaymentError'),
    statusLookupFields: members(named(protocol, 'HostPaymentStatusSubscribeRequest')),
    hostDeclarationsSha256: hash(hostText),
    protocolDeclarationsSha256: hash(protocolText)
  };
}

export async function inspectPinnedPayments(root = web) {
  const packages = join(root, 'node_modules', '@parity');
  const [sdk, host, protocol, hostText, protocolText] = await Promise.all([
    readFile(join(root, 'package.json'), 'utf8').then(JSON.parse),
    readFile(join(packages, 'product-sdk-host/package.json'), 'utf8').then(JSON.parse),
    readFile(join(packages, 'truapi/package.json'), 'utf8').then(JSON.parse),
    readFile(join(packages, 'product-sdk-host/dist/index.d.ts'), 'utf8'),
    readFile(join(packages, 'truapi/dist/generated/types.d.ts'), 'utf8')
  ]);
  if (sdk.dependencies['@parity/product-sdk-host'] !== host.version) throw new Error('Installed Host SDK differs from the tracked pin.');
  return {
    sdk: sdk.dependencies['@parity/product-sdk'],
    host: host.version,
    protocol: protocol.version,
    ...inspectPaymentDeclarations(hostText, protocolText)
  };
}

/** Every observation is research input, never an entitlement or a verified royalty receipt. */
export function interpretCashObservation(surface, event, requested) {
  if (typeof requested !== 'bigint' || requested <= 0n) throw new Error('Positive exact integer amount required.');
  const result = state => ({ state, allowNewPayment: false, grantsAccess: false, verifiesWorkTip: false });
  if (surface === 'payment') {
    if (event?.tag === 'Processing') return result('pending');
    if (event?.tag === 'Completed') return result('host-reported-complete');
    if (event?.tag === 'ClaimedPartially') {
      const amount = event.value?.actualClaimed;
      return result(typeof amount === 'bigint' && amount >= 0n && amount < requested ? 'partial' : 'invalid-observation');
    }
    // Neither Failed(reason) nor PaymentNotFound proves that no value moved.
    return result('unresolved');
  }
  if (surface === 'coinPayment') {
    const amount = event?.value?.cleared;
    if (!Number.isSafeInteger(amount) || amount < 0 || BigInt(amount) > requested) return result('invalid-observation');
    if (event.tag === 'Clearing') return result('pending');
    if (event.tag === 'Failed') return result(amount > 0 ? 'partial' : 'unresolved');
    if (event.tag === 'Done') return result(BigInt(amount) === requested ? 'clearing-reported-complete' : 'invalid-observation');
  }
  return result('unresolved');
}

/** No executable adapter is returned. These are independent activation requirements. */
export function decideCashWorkTip(surface) {
  const blockers = [];
  if (!surface.callerChosenId || !surface.requestErrorTags.includes('AlreadyExists')) blockers.push('pinned-api-cannot-recover-a-lost-request-id');
  blockers.push('shipped-host-payment-and-restart-support-unverified');
  blockers.push('payment-balance-unit-not-bound-to-the-shipped-host');
  blockers.push('no-verified-runtime-split-and-room-receipt-settlement');
  return { decision: 'no-go', scope: 'cash-work-tip', blockers, cashEnabled: false, accessGranted: false };
}

export async function reportCashTipFeasibility() {
  const pinned = await inspectPinnedPayments();
  return {
    schema: 'dotify.cash-tip-feasibility.v1',
    observed: pinned,
    ...decideCashWorkTip(pinned),
    evidence: 'offline-declarations-and-research-model-only',
    nativePasChanged: false,
    hostMethodsCalled: 0,
    networkCalls: 0,
    paymentsSubmitted: 0
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--json-out' || !args[1])) throw new Error('Usage: product-cash-tip-feasibility.mjs [--json-out path]');
  const report = await reportCashTipFeasibility();
  const text = JSON.stringify(report, null, 2) + '\n';
  if (args.length) await writeFile(args[1], text, { mode: 0o600 });
  console.log(text.trim());
}
