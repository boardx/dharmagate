import {createPracticeAudio,OUTPUT_COMPRESSOR} from '../src/practice/audio.mjs';
// Transport/decoder mock only: ID3 header bytes represent an encoded-container input,
// not a complete playable MP3. Actual recording/codec/device checks are separate.
export const ENCODED_FIXTURE=Uint8Array.from([73,68,51,4,0,0,0,0,0,0,255,251,144,0]);
export const TEST_RECORDINGS=Object.freeze({
 'recorded-bowl-struck':{id:'recorded-bowl-struck',available:true,recorded:true,continuous:false,recording:{licenseVerified:true,mediaUrl:'/practice/audio/a1b2c3-bowl-struck.mp3'}},
 'recorded-bowl-rubbed':{id:'recorded-bowl-rubbed',available:true,recorded:true,continuous:true,recording:{licenseVerified:true,mediaUrl:'/practice/audio/d4e5f6-bowl-rubbed.mp3'}},
 'legacy-unavailable':{id:'legacy-unavailable',available:false,recorded:false,continuous:false}
});
export const TEST_CUES=['silent','recorded-bowl-struck'];
export function recordedFixture({deferResume=false,deferFetch=false,deferDecode=false,fetchStatus=200,decodeFails=false,mime='audio/mpeg',session={type:'auto',state:'active'},compressor=true,catalogue=TEST_RECORDINGS,cueIds=TEST_CUES}={}){
 const nodes=[],buffers=[],tasks=[],loadTimers=new Map(),unlockTimers=new Map(),requests=[],decodedInputs=[],calls=[];let resolveResume,rejectResume,resolveFetch,resolveDecode,next=0;
 const param=()=>({value:0,cancelScheduledValues(){},setValueAtTime(v){this.value=v},linearRampToValueAtTime(v){this.value=v},exponentialRampToValueAtTime(v){this.value=v}});
 const node=()=>{const n={gain:param(),startCount:0,stopCount:0,disconnectCount:0,connections:[],connect(target){this.connections.push(target)},disconnect(){this.disconnectCount++;this.connections=[]},start(){this.startCount++},stop(at){this.stopCount++;this.stopAt=at}};nodes.push(n);return n};
 const makeBuffer=()=>{const b={duration:2.5,numberOfChannels:1,length:120000,sampleRate:48000};buffers.push(b);return b};
 const response=()=>({ok:fetchStatus===200,status:fetchStatus,redirected:false,headers:{get(name){return name==='content-type'?mime:name==='content-length'?String(ENCODED_FIXTURE.byteLength):null}},async arrayBuffer(){return ENCODED_FIXTURE.buffer.slice(0)}});
 const context={state:'suspended',currentTime:0,destination:{},createGain:node,createBufferSource:node,resume(){calls.push({type:'resume',sessionType:session?.type});if(deferResume)return new Promise((r,j)=>{resolveResume=()=>{context.state='running';r()};rejectResume=j});context.state='running';return Promise.resolve()},decodeAudioData(input){decodedInputs.push(new Uint8Array(input));if(decodeFails)return Promise.reject(Error('codec'));if(deferDecode)return new Promise(r=>{resolveDecode=()=>r(makeBuffer())});return Promise.resolve(makeBuffer())},async close(){context.state='closed'}};
 if(compressor)context.createDynamicsCompressor=()=>{const n=node();n.kind='compressor';for(const key of Object.keys(OUTPUT_COMPRESSOR))n[key]=param();return n};
 const engine=createPracticeAudio({createContext:()=>{calls.push({type:'create'});return context},getAudioSession:()=>session,soundCatalogue:catalogue,cueIds,fetchRecording(url,options){requests.push({url,options});if(deferFetch)return new Promise(r=>{resolveFetch=()=>r(response())});return Promise.resolve(response())},schedule:fn=>{tasks.push(fn);return tasks.length},cancel(){},scheduleUnlock:fn=>{const id=++next;unlockTimers.set(id,fn);return id},cancelUnlock:id=>unlockTimers.delete(id),scheduleLoad:fn=>{const id=++next;loadTimers.set(id,fn);return id},cancelLoad:id=>loadTimers.delete(id)});
 return{engine,context,nodes,buffers,tasks,requests,decodedInputs,calls,loadTimers,unlockTimers,resolveResume:()=>resolveResume(),rejectResume:()=>rejectResume(Error('resume blocked')),resolveFetch:()=>resolveFetch(),resolveDecode:()=>resolveDecode(),changeState(value){context.state=value;context.onstatechange?.()}};
}
export async function settle(){for(let i=0;i<12;i++)await Promise.resolve()}
