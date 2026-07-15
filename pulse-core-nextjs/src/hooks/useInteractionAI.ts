/**
 * useInteractionAI
 *
 * Checks for drug-drug interactions and patient allergy matches using AfyaInsight™ AI.
 * Connects to /api/ai/pharmacy/check-interactions.
 */

'use client';

import { useState, useCallback } from 'react';
import logger from '@/lib/logger';

export interface DrugInteraction {
    drug_a: string;
    drug_b: string;
    severity: 'low' | 'medium' | 'high';
    summary: string;
    confidence: number;
}

interface UseInteractionAIReturn {
    isChecking: boolean;
    interactions: DrugInteraction[];
    error: string | null;
    checkInteractions: (drugs: string[]) => Promise<void>;
    reset: () => void;
}

export function useInteractionAI(): UseInteractionAIReturn {
    const [isChecking, setIsChecking] = useState(false);
    const [interactions, setInteractions] = useState<DrugInteraction[]>([]);
    const [error, setError] = useState<string | null>(null);

    const reset = useCallback(() => {
        setInteractions([]);
        setError(null);
        setIsChecking(false);
    }, []);

    const checkInteractions = useCallback(async (drugs: string[]) => {
        if (drugs.length < 2) {
            setInteractions([]);
            return;
        }

        setIsChecking(true);
        setError(null);

        try {
            const response = await fetch('/api/ai/pharmacy/check-interactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ drugs }),
            });

            if (!response.ok) {
                throw new Error(`Interaction API failed with status ${response.status}`);
            }

            const data = await response.json();
            setInteractions(data.interactions || []);
            setIsChecking(false);
        } catch (err) {
            logger.error('Interaction check failed', { err });
            setError('Unable to run interaction checks right now. Please retry.');
            setInteractions([]);
            setIsChecking(false);
        }
    }, []);

    return {
        isChecking,
        interactions,
        error,
        checkInteractions,
        reset,
    };
}
