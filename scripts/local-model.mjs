import { spawn } from 'node:child_process';
const child=spawn('ollama',['serve'],{stdio:'inherit',env:{...process.env,OLLAMA_NO_CLOUD:'1',OLLAMA_HOST:'127.0.0.1:11434'}});
child.on('error',()=>{console.error('Install the official Ollama runtime and an approved local model before loading challenge data. No model is downloaded automatically.');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
