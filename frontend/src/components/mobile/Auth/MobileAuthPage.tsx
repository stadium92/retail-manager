import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Mail, Lock, User, ArrowRight, UserPlus } from 'lucide-react';
import logoUrl from '@/assets/logo.png';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';

export interface MobileAuthPageProps {
    loginData: any;
    setLoginData: (data: any) => void;
    signupData: any;
    setSignupData: (data: any) => void;
    handleLogin: (e: React.FormEvent) => Promise<void>;
    handleSignup: (e: React.FormEvent) => Promise<void>;
    loading: boolean;
    errors: Record<string, string>;
}

export function MobileAuthPage({
    loginData,
    setLoginData,
    signupData,
    setSignupData,
    handleLogin,
    handleSignup,
    loading,
    errors
}: MobileAuthPageProps) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');

    return (
        <div className="bg-background text-foreground min-h-screen flex flex-col items-center justify-center px-4 py-8 overflow-y-auto dark antialiased"
             style={{ backgroundImage: 'radial-gradient(circle at top, hsl(var(--primary)/0.12) 0%, hsl(var(--background)) 70%)' }}>
            
            <div className="absolute top-4 right-4 z-50">
                <LanguageSwitcher />
            </div>

            {/* Header Section */}
            <div className="flex flex-col items-center mb-6 w-full max-w-sm mt-8">
                <div className="w-24 h-24 mb-5 rounded-2xl overflow-hidden shadow-2xl border border-border bg-card flex items-center justify-center relative group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent opacity-50"></div>
                    <img alt="DJATI Logo" className="w-full h-full object-contain p-2 z-10 relative" src={logoUrl} />
                </div>
                <h1 className="font-extrabold text-3xl text-foreground mb-2 tracking-tight uppercase">DJATI</h1>
                <p className="text-muted-foreground text-center text-sm max-w-[280px]">
                    {t('auth.description') || "Votre plateforme intelligente de gestion de commandes au détail"}
                </p>
            </div>

            {/* Login/Signup Card */}
            <div className="w-full max-w-sm bg-card/65 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-border/80 relative overflow-hidden">
                {/* Segmented Control for Connexion / Inscription */}
                <div className="flex bg-muted/60 rounded-xl p-1 mb-5 border border-border/40">
                    <button 
                        onClick={() => setActiveTab('login')}
                        type="button"
                        id="mobile-trigger-login"
                        className={`flex-1 py-2.5 rounded-lg shadow-sm font-semibold transition-all duration-200 ${
                            activeTab === 'login' 
                                ? 'bg-background border border-border/50 text-primary shadow-lg' 
                                : 'text-muted-foreground hover:text-foreground border border-transparent'
                        }`}>
                        {t('auth.login')}
                    </button>
                    <button 
                        onClick={() => setActiveTab('signup')}
                        type="button"
                        id="mobile-trigger-signup"
                        className={`flex-1 py-2.5 rounded-lg shadow-sm font-semibold transition-all duration-200 ${
                            activeTab === 'signup' 
                                ? 'bg-background border border-border/50 text-primary shadow-lg' 
                                : 'text-muted-foreground hover:text-foreground border border-transparent'
                        }`}>
                        {t('auth.signup')}
                    </button>
                </div>

                {errors.form && (
                    <div className="mb-4 p-3 bg-destructive/15 text-destructive rounded-lg text-sm border border-destructive/20 font-semibold">
                        {errors.form}
                    </div>
                )}

                {activeTab === 'login' ? (
                    <form className="flex flex-col gap-4" onSubmit={handleLogin}>
                        {/* Email Input */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-muted-foreground pl-1" htmlFor="email">{t('auth.email')}</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 h-4.5 w-4.5" />
                                <input 
                                    className={`w-full h-[48px] bg-background border ${errors.email ? 'border-destructive' : 'border-border/60'} rounded-lg pl-10 pr-4 text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200`} 
                                    id="email" 
                                    type="email" 
                                    placeholder="vous@exemple.com"
                                    value={loginData.email}
                                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                                    disabled={loading}
                                />
                            </div>
                            {errors.email && <p className="text-xs text-destructive pl-1">{errors.email}</p>}
                        </div>

                        {/* Password Input */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-muted-foreground pl-1" htmlFor="password">{t('auth.password')}</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 h-4.5 w-4.5" />
                                <input 
                                    className={`w-full h-[48px] bg-background border ${errors.password ? 'border-destructive' : 'border-border/60'} rounded-lg pl-10 pr-4 text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200`} 
                                    id="password" 
                                    type="password" 
                                    placeholder="••••••••"
                                    value={loginData.password}
                                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                                    disabled={loading}
                                />
                            </div>
                            {errors.password && <p className="text-xs text-destructive pl-1">{errors.password}</p>}
                        </div>

                        {/* Forgot Password Link */}
                        <div className="flex justify-end mt-[-4px]">
                            <a className="text-xs text-primary hover:underline transition-all duration-200" href="#">
                                Mot de passe oublié ?
                            </a>
                        </div>

                        {/* Submit Button */}
                        <button 
                            disabled={loading}
                            className="mt-2 w-full h-[48px] bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-lg shadow-md transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50" 
                            type="submit">
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    <span>{t('auth.signingIn')}</span>
                                </>
                            ) : (
                                <>
                                    <span>{t('auth.signIn')}</span>
                                    <ArrowRight className="h-4.5 w-4.5" />
                                </>
                            )}
                        </button>
                    </form>
                ) : (
                    <form className="flex flex-col gap-4" onSubmit={handleSignup}>
                        {/* Name Input */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-muted-foreground pl-1" htmlFor="signup-name">{t('auth.fullName')}</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 h-4.5 w-4.5" />
                                <input 
                                    className={`w-full h-[48px] bg-background border ${errors.fullName ? 'border-destructive' : 'border-border/60'} rounded-lg pl-10 pr-4 text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200`} 
                                    id="signup-name" 
                                    type="text" 
                                    placeholder="John Doe"
                                    value={signupData.fullName}
                                    onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                                    disabled={loading}
                                />
                            </div>
                            {errors.fullName && <p className="text-xs text-destructive pl-1">{errors.fullName}</p>}
                        </div>

                        {/* Email Input */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-muted-foreground pl-1" htmlFor="signup-email">{t('auth.email')}</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 h-4.5 w-4.5" />
                                <input 
                                    className={`w-full h-[48px] bg-background border ${errors.email ? 'border-destructive' : 'border-border/60'} rounded-lg pl-10 pr-4 text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200`} 
                                    id="signup-email" 
                                    type="email" 
                                    placeholder="vous@exemple.com"
                                    value={signupData.email}
                                    onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                                    disabled={loading}
                                />
                            </div>
                            {errors.email && <p className="text-xs text-destructive pl-1">{errors.email}</p>}
                        </div>

                        {/* Password Input */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-muted-foreground pl-1" htmlFor="signup-password">{t('auth.password')}</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 h-4.5 w-4.5" />
                                <input 
                                    className={`w-full h-[48px] bg-background border ${errors.password ? 'border-destructive' : 'border-border/60'} rounded-lg pl-10 pr-4 text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200`} 
                                    id="signup-password" 
                                    type="password" 
                                    placeholder="••••••••"
                                    value={signupData.password}
                                    onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                                    disabled={loading}
                                />
                            </div>
                            {errors.password && <p className="text-xs text-destructive pl-1">{errors.password}</p>}
                        </div>

                        {/* Confirm Password Input */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-muted-foreground pl-1" htmlFor="signup-confirm">{t('auth.confirmPassword')}</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 h-4.5 w-4.5" />
                                <input 
                                    className={`w-full h-[48px] bg-background border ${errors.confirmPassword ? 'border-destructive' : 'border-border/60'} rounded-lg pl-10 pr-4 text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200`} 
                                    id="signup-confirm" 
                                    type="password" 
                                    placeholder="••••••••"
                                    value={signupData.confirmPassword}
                                    onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                                    disabled={loading}
                                />
                            </div>
                            {errors.confirmPassword && <p className="text-xs text-destructive pl-1">{errors.confirmPassword}</p>}
                        </div>

                        {/* Submit Button */}
                        <button 
                            disabled={loading}
                            className="mt-2 w-full h-[48px] bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-lg shadow-md transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50" 
                            type="submit">
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    <span>{t('auth.creatingAccount') || "Création..."}</span>
                                </>
                            ) : (
                                <>
                                    <span>{t('auth.createAccount')}</span>
                                    <UserPlus className="h-4.5 w-4.5" />
                                </>
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
