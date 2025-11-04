import { useEffect, useRef, useState } from 'react';
import './App.css';
import * as cbor from '@atcute/cbor';
import * as car from '@atcute/car';
import { Howl, Howler } from 'howler';

const RELAY_FIREHOSE_URI = 'wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos';
const DATA_PERIOD = 1 * 1000;
const DATA_INTERVAL = 10;

function App() {
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [metric, setMetric] = useState<number>(0.0);
    const wsRef = useRef<WebSocket>(undefined);
    const timeoutRef = useRef<number>(0);
    const postListRef = useRef<number[]>([]);

    const geigerTick = useRef<Howl>(null);
    const isGeiger = useRef<HTMLInputElement>(null);

    useEffect(() => {
        wsRef.current = new WebSocket(RELAY_FIREHOSE_URI);
        wsRef.current.onopen = () => {
            setIsConnected(true);
        };
        wsRef.current.onclose = () => {
            setIsConnected(false);
        };

        wsRef.current.onmessage = async msg => {
            const array = new Uint8Array(await msg.data.arrayBuffer());
            const [_, remainder] = cbor.decodeFirst(array);
            const [body] = cbor.decodeFirst(remainder);
            if (!body.blocks) return;
            const carBlocks = car.fromUint8Array(body.blocks.buf);

            for (const block of carBlocks) {
                const record = cbor.decode(block.bytes);
                if (record?.$type === 'app.bsky.feed.post') {
                    if (isGeiger.current?.checked && geigerTick.current)
                        geigerTick.current.play();

                    postListRef.current.push(Date.now());
                    if (postListRef.current.length > 1000) {
                        postListRef.current.shift();
                    }
                }
            }
        };

        return () => {
            wsRef.current?.close();
        }
    }, []);

    useEffect(() => {
        timeoutRef.current = setInterval(() => {
            if (!isConnected) return;
            const filtered = postListRef.current.filter(e => Date.now() - e < DATA_PERIOD);
            const postsPerSecond = filtered.length / (DATA_PERIOD / 1000);
            setMetric(postsPerSecond);
        }, DATA_INTERVAL);
        return () => {
            clearInterval(timeoutRef.current);
        }
    }, [isConnected]);

    // audio
    useEffect(() => {
        Howler.volume(0.3);
        geigerTick.current = new Howl({
            src: ['/tick.ogg'],
            preload: true,
            loop: false
        });
        return () => {
            geigerTick.current?.unload();
        }
    }, []);

    return (
        <>
            <div className='main'>
                <h2>The Bluesky firehose is running at</h2>
                <h1 className='metric'>{ isConnected ? metric.toFixed(1) : 'connecting...' }</h1>
                <h2>posts per second</h2>

                <details className='options'>
                    <summary>options</summary>
                    <input id='check-geiger' type='checkbox' ref={isGeiger}/>
                    <label htmlFor='check-geiger'>geiger counter mode</label>
                </details>
            </div>
            <div className='footer'>
                <p>Real-time data sourced from the firehose. Powered by atcute. Built by Nightshade in about 30 minutes.</p>
            </div>
        </>
    )
}

export default App
