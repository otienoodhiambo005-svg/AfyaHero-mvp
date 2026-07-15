'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import logger from '@/lib/logger';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

export function useWebRTC(roomId: string, isInitiator: boolean, enableVideo: boolean = true) {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isCallActive, setIsCallActive] = useState(false);
    const pc = useRef<RTCPeerConnection | null>(null);
    const channel = useRef<RealtimeChannel | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    const cleanup = useCallback(() => {
        if (pc.current) {
            pc.current.close();
            pc.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
            setLocalStream(null);
        }
        setRemoteStream(null);
        setIsCallActive(false);
        if (channel.current) {
            supabase.removeChannel(channel.current);
            channel.current = null;
        }
    }, []);

    const setupSignalChannel = useCallback(async () => {
        channel.current = supabase.channel(`call:${roomId}`);

        channel.current
            .on('broadcast', { event: 'signal' }, async ({ payload }: any) => {
                if (!pc.current) return;

                const { type, sdp, candidate } = payload;

                if (type === 'offer' && !isInitiator) {
                    await pc.current.setRemoteDescription(new RTCSessionDescription(sdp));
                    const answer = await pc.current.createAnswer();
                    await pc.current.setLocalDescription(answer);
                    if (channel.current) {
                        channel.current.send({
                            type: 'broadcast',
                            event: 'signal',
                            payload: { type: 'answer', sdp: answer }
                        });
                    }
                } else if (type === 'answer' && isInitiator) {
                    await pc.current.setRemoteDescription(new RTCSessionDescription(sdp));
                } else if (type === 'candidate') {
                    await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
                }
            })
            .subscribe();

        return channel.current;
    }, [roomId, isInitiator]);

    const startCall = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: enableVideo,
                audio: true
            });
            localStreamRef.current = stream;
            setLocalStream(stream);

            pc.current = new RTCPeerConnection(ICE_SERVERS);

            stream.getTracks().forEach(track => {
                pc.current?.addTrack(track, stream);
            });

            pc.current.ontrack = (event) => {
                setRemoteStream(event.streams[0]);
            };

            pc.current.onicecandidate = (event) => {
                if (event.candidate) {
                    channel.current?.send({
                        type: 'broadcast',
                        event: 'signal',
                        payload: { type: 'candidate', candidate: event.candidate }
                    });
                }
            };

            await setupSignalChannel();

            if (isInitiator) {
                const offer = await pc.current.createOffer();
                await pc.current.setLocalDescription(offer);
                channel.current?.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { type: 'offer', sdp: offer }
                });
            }

            setIsCallActive(true);
        } catch (err) {
            logger.error('Failed to start call', { error: err, roomId, isInitiator, enableVideo });
        }
    };

    const endCall = () => {
        cleanup();
    };

    useEffect(() => {
        return () => cleanup();
    }, [cleanup]);

    return {
        localStream,
        remoteStream,
        isCallActive,
        startCall,
        endCall
    };
}
