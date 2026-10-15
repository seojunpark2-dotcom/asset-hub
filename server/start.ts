import {gateway} from './gateway.ts';
gateway(process.env).listen(Number(process.env.PORT??8080),process.env.BIND_ADDRESS??'127.0.0.1');
