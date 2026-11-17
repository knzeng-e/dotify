// Reviewed maintenance provisioning only. No signer import, key read or store.
import assert from 'node:assert/strict';
import {mkdir,open,readFile,readdir,lstat,access} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function provisionFreshPilot(plan,{modules,finalizedNonce}) {
 const mod=name=>import(pathToFileURL(join(modules,name+'.js')).href);
 const state=await mod('bulletinMediaState'),pub=await mod('bulletinPublisherProfile'),assets=await mod('bulletinPublicAssets');
 const {acquireBulletinPublisherLock}=await mod('bulletinPublisherLock');
 const {streamingJobsSchema}=await mod('streamingJobs');
 assert.ok(Number.isSafeInteger(finalizedNonce)&&finalizedNonce>=1120&&finalizedNonce<0x100000000);
 const old=await pub.readBulletinPublisherProfile(plan.previousProfileFile);
 assert.deepEqual(old,plan.previousProfile);
 assert.deepEqual(await assets.readPublicAssetPolicy(plan.previousPolicyFile,old),plan.previousPolicy);
 const fresh=pub.publisherProfileSchema.parse(plan.newProfile),policy=assets.publicAssetPolicySchema.parse(plan.newPolicy);
 for(const key of ['account','genesis','seedFile','endpoint','pipeline','pilotScope'])assert.deepEqual(fresh[key],old[key]);
 assert.equal(fresh.priorRenewalReserve.transactions,215);assert.equal(fresh.priorRenewalReserve.bytes,63639252);
 assert.deepEqual(fresh.budget,{maxBytes:1048576,maxTransactions:16,minimumLifetimeBlocks:100});
 assert.equal(policy.owner,plan.previousPolicy.owner);assert.deepEqual(policy.scope,old.pilotScope);
 assert.deepEqual(policy.cover,{maxBytes:524288,maxTransactions:16,minimumLifetimeBlocks:100});
 assert.deepEqual(policy.metadata,{maxBytes:65536,maxTransactions:4,minimumLifetimeBlocks:100});
 assert.notEqual(fresh.directory,old.directory);assert.notEqual(plan.newQueue,plan.previousQueue);
 const queue=streamingJobsSchema.parse(await state.load(join(plan.previousQueue,'jobs.json')));
 assert.ok(queue.jobs.every(j=>['ready','failed','expired'].includes(j.state)),'Old queue has active work');
 const owner=state.ownerSchema.parse(await state.load(join(old.directory,'owner.json')));
 assert.equal(owner.activeJob,null);assert.ok(owner.nextNonce===null||finalizedNonce>=owner.nextNonce);
 for(const job of owner.jobs){const inv=state.jobSchema.parse(await state.load(join(old.directory,job+'.json')));assert.equal(Object.keys(inv.pending).length,0,'Uncertain old submission');}
 for(const path of [join(old.directory,'writer.lock'),fresh.directory,plan.newQueue,plan.newProfileFile,plan.newPolicyFile])await assert.rejects(access(path),{code:'ENOENT'});
 const release=await acquireBulletinPublisherLock(old);
 const checkedFile=async file=>{const s=await lstat(file);assert.ok(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.uid===process.getuid()&&!(s.mode&0o077)&&s.size<=2*1024*1024);return readFile(file);};
 const nonceFiles=async base=>{
  await state.privateDirectory(base);const out=[];
  assert.deepEqual(JSON.parse((await checkedFile(join(base,'ledger.json'))).toString()),{schema:'dotify.streaming.nonce-ledger.v1'});
  for(const key of (await readdir(base)).filter(n=>n!=='ledger.json').sort()){
   assert.match(key,/^[a-f0-9]{64}$/);await state.privateDirectory(join(base,key));
   for(const file of (await readdir(join(base,key))).sort()){
    assert.match(file,/^[a-f0-9]{16}\.json$/);const bytes=await checkedFile(join(base,key,file));
    assert.deepEqual(JSON.parse(bytes.toString()),{schema:'dotify.streaming.nonce-ledger.v1',fingerprint:key,generation:file.slice(0,16)});
    out.push({key,file,bytes});
   }
  }return out;
 };
 const snapshot=async()=>{
  const files=(await readdir(old.directory)).filter(f=>f.endsWith('.json')).sort();const hashes={};
  for(const f of files)hashes['publisher/'+f]=sha(await checkedFile(join(old.directory,f)));
  hashes['queue/jobs.json']=sha(await checkedFile(join(plan.previousQueue,'jobs.json')));
  hashes['queue/ledger.json']=sha(await checkedFile(join(plan.previousQueue,'nonces','ledger.json')));
  for(const n of await nonceFiles(join(plan.previousQueue,'nonces')))hashes['nonce/'+n.key+'/'+n.file]=sha(n.bytes);
  return hashes;
 };
 try {
  const before=await snapshot(),reservations=await nonceFiles(join(plan.previousQueue,'nonces'));
  for(const [file,value] of [[plan.newProfileFile,fresh],[plan.newPolicyFile,policy]]){
   const h=await open(file,'wx',0o600);try{await h.writeFile(JSON.stringify(value));await h.sync();}finally{await h.close();}
  }
  await pub.initializeBulletinPublisher(plan.newQueue,fresh);
  await assets.initializePublicAssetPolicy(fresh,policy);
  for(const n of reservations){const dir=join(plan.newQueue,'nonces',n.key);await mkdir(dir,{recursive:true,mode:0o700});const h=await open(join(dir,n.file),'wx',0o600);try{await h.writeFile(n.bytes);await h.sync();}finally{await h.close();}await state.sync(dir);}
  await state.sync(join(plan.newQueue,'nonces'));
  const next=state.ownerSchema.parse(await state.load(join(fresh.directory,'owner.json')));assert.deepEqual(next.jobs,[]);assert.equal(next.nextNonce,null);
  await state.save(fresh.directory,'owner.json',{...next,nextNonce:finalizedNonce});
  await state.sync(join(plan.newProfileFile,'..'));
  assert.deepEqual(await snapshot(),before,'Old permanent state changed');
  const copied=await nonceFiles(join(plan.newQueue,'nonces'));
  assert.deepEqual(copied.map(n=>[n.key,n.file,sha(n.bytes)]),reservations.map(n=>[n.key,n.file,sha(n.bytes)]));
  await pub.assertPublicationBinding(plan.newQueue,fresh);
  await assets.readPublicAssetPolicy(plan.newPolicyFile,fresh);
  return {oldStateUnchanged:true,oldStateHashes:before,nonceReservationsCopied:copied.length,newQueueEmpty:true,newCursor:finalizedNonce,newProfileSha256:pub.publicationBinding(fresh).profileSha256,signerRead:false,networkWrites:0};
 }finally{await release();}
}
