import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldAlert, Lock, Loader2, KeyRound, CheckCircle2 } from "lucide-react";
import { useLicense, LicenseStatus } from "@/contexts/LicenseContext";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Logger } from '@/utils/Logger';
import { cn } from '@/lib/utils';

interface ActivationGateProps {
    status: LicenseStatus;
    onActivated: () => void;
    onSkip: () => void;
}

export function ActivationGate({ status, onActivated, onSkip }: ActivationGateProps) {
    const { t } = useTranslation();
    const { activate } = useLicense();
    const [key, setKey] = useState('');
    const [storeName, setStoreName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status_type, setStatusType] = useState<'idle' | 'error' | 'success'>('idle');
    
    // Brute-force protection state
    const [attemptsToday, setAttemptsToday] = useState(0);
    const [totalMisses, setTotalMisses] = useState(0);
    const [isLocked, setIsLocked] = useState(false);

    const loadState = () => {
        const today = new Date().toISOString().split('T')[0];
        const lastAttemptDate = localStorage.getItem('rm_last_attempt_date');
        
        let currentAttempts = 0;
        if (lastAttemptDate !== today) {
            localStorage.setItem('rm_last_attempt_date', today);
            localStorage.setItem('rm_attempts_today', '0');
        } else {
            currentAttempts = parseInt(localStorage.getItem('rm_attempts_today') || '0');
        }
        setAttemptsToday(currentAttempts);

        const misses = parseInt(localStorage.getItem('rm_total_misses') || '0');
        setTotalMisses(misses);

        if (currentAttempts >= 3 || misses >= 15) {
            setIsLocked(true);
        }
    };

    useEffect(() => {
        loadState();
    }, []);

    const handleActivate = async () => {
        if (isLocked) {
            toast.error("Too many attempts", { description: "Please wait until tomorrow to try again." });
            return;
        }

        if (!key || !storeName) {
            setStatusType('error');
            toast.error(t('common.error'), { description: "Please fill all fields" });
            return;
        }

        setIsSubmitting(true);
        setStatusType('idle');
        
        try {
            await activate(key, storeName);
            setStatusType('success');
            toast.success(t('common.success'), { description: "Application activated successfully!" });
            localStorage.removeItem('rm_total_misses');
            localStorage.removeItem('rm_attempts_today');
            
            // Short delay to show the green state before entering the app
            setTimeout(() => {
                onActivated();
            }, 1500);
        } catch (error: any) {
            const newAttempts = attemptsToday + 1;
            const newMisses = totalMisses + 1;
            
            // Update state and storage immediately
            setAttemptsToday(newAttempts);
            setTotalMisses(newMisses);
            localStorage.setItem('rm_attempts_today', newAttempts.toString());
            localStorage.setItem('rm_total_misses', newMisses.toString());

            setStatusType('error');

            if (newAttempts >= 3 || newMisses >= 15) {
                setIsLocked(true);
                await Logger.error('ACTIVATION_LOCKOUT', {
                    notes: `User locked out after ${newAttempts} attempts today (Total misses: ${newMisses})`,
                    new_value: status.device_hash
                });
            }

            toast.error(t('common.error'), { 
                description: error.message || "Invalid activation key" 
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
            <Card className={cn(
                "w-full max-w-[450px] shadow-2xl border-2 transition-all duration-300",
                status_type === 'error' ? "border-destructive animate-shake" : 
                status_type === 'success' ? "border-green-500 bg-green-50/10" : "border-primary/20"
            )}>
                <CardHeader className="space-y-1">
                    <div className={cn(
                        "mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors",
                        isLocked ? "bg-destructive/10" : 
                        status_type === 'success' ? "bg-green-100" : "bg-primary/10"
                    )}>
                        {isLocked ? <Lock className="h-8 w-8 text-destructive" /> : 
                         status_type === 'success' ? <CheckCircle2 className="h-8 w-8 text-green-600" /> :
                         <KeyRound className="h-8 w-8 text-primary" />}
                    </div>
                    <CardTitle className="text-2xl text-center font-bold">
                        {isLocked ? "System Locked" : status_type === 'success' ? "Verified!" : "Product Activation"}
                    </CardTitle>
                    <CardDescription className="text-center text-base px-2">
                        {isLocked 
                            ? "You have reached the limit of activation attempts for today. Please contact support or try again tomorrow."
                            : status_type === 'success' 
                            ? "Your license is valid. Preparing your workspace..."
                            : "Welcome to Retail Manager. Please enter your activation key to unlock the full features."}
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 py-4">
                    <div className="p-4 bg-muted/50 rounded-xl border flex items-center justify-between">
                        <div className="space-y-0.5">
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Hardware ID</div>
                            <code className="text-sm font-mono font-bold tracking-tight">{status.device_hash}</code>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => {
                            navigator.clipboard.writeText(status.device_hash);
                            toast.info("Copied to clipboard");
                        }}>Copy</Button>
                    </div>

                    {!isLocked && status_type !== 'success' && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="store_name" className="text-xs font-bold uppercase tracking-wider">Store Name</Label>
                                <Input
                                    id="store_name"
                                    placeholder="e.g. Sanifere Boutique"
                                    value={storeName}
                                    onChange={(e) => setStoreName(e.target.value)}
                                    className="h-11"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="key" className="text-xs font-bold uppercase tracking-wider">Activation Key</Label>
                                <Input
                                    id="key"
                                    placeholder="RM-XXXX-XXXX-XXXX-XXXX"
                                    value={key}
                                    onChange={(e) => {
                                        setKey(e.target.value.toUpperCase());
                                        if(status_type === 'error') setStatusType('idle');
                                    }}
                                    className={cn(
                                        "h-11 font-mono text-center tracking-widest",
                                        status_type === 'error' && "border-destructive text-destructive"
                                    )}
                                />
                            </div>
                            
                            <div className={cn(
                                "text-[10px] text-center font-bold uppercase tracking-tighter",
                                attemptsToday > 0 ? "text-amber-600" : "text-muted-foreground"
                            )}>
                                Attempts today: {attemptsToday}/3 | Total fails: {totalMisses}/15
                            </div>
                        </>
                    )}
                </CardContent>

                <CardFooter className="flex flex-col gap-3 pt-2">
                    <Button 
                        onClick={handleActivate} 
                        className={cn(
                            "w-full h-11 text-base font-bold transition-all",
                            status_type === 'success' ? "bg-green-600 hover:bg-green-600" : ""
                        )} 
                        disabled={isSubmitting || isLocked || status_type === 'success'}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Validating...
                            </>
                        ) : status_type === 'success' ? (
                            "Success!"
                        ) : "Unlock Professional Version"}
                    </Button>
                    
                    {(status.status === 'trial' || status.status === 'active') && !isLocked && status_type !== 'success' && (
                        <Button 
                            variant="link" 
                            onClick={onSkip} 
                            className="w-full text-muted-foreground text-sm"
                        >
                            Continue with Trial Version ({status.days_remaining} days left)
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}
