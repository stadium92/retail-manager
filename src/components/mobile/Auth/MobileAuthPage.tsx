import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
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
        <div className="bg-rs-background text-rs-on-background min-h-screen flex flex-col items-center justify-center px-4 py-6 overflow-y-auto dark antialiased"
             style={{ backgroundImage: 'radial-gradient(circle at top, #211b12 0%, #18120a 60%)' }}>
            
            <div className="absolute top-4 right-4 z-50">
                <LanguageSwitcher />
            </div>

            {/* Header Section */}
            <div className="flex flex-col items-center mb-6 w-full max-w-sm mt-8">
                <div className="w-24 h-24 mb-6 rounded-2xl overflow-hidden shadow-2xl border border-rs-outline/20 bg-rs-surface-container flex items-center justify-center relative group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-rs-primary/10 to-transparent opacity-50"></div>
                    <img alt="DJATI Logo" className="w-full h-full object-contain p-2 z-10 relative" src={logoUrl} />
                </div>
                <h1 className="font-bold text-2xl text-rs-on-surface mb-2 tracking-tight">DJATI</h1>
                <p className="text-rs-on-surface-variant text-center max-w-[280px]">
                    {t('auth.description') || "Votre plateforme intelligente de gestion de commandes au détail"}
                </p>
            </div>

            {/* Login Card */}
            <div className="w-full max-w-sm bg-rs-surface-container rounded-2xl p-5 shadow-2xl border border-rs-outline/30 relative overflow-hidden">
                {/* Segmented Control for Connexion / Inscription */}
                <div className="flex bg-rs-surface-container-highest rounded-lg p-1 mb-5 border border-rs-outline/20">
                    <button 
                        onClick={() => setActiveTab('login')}
                        className={`flex-1 py-2 rounded-md shadow-sm font-medium transition-all duration-200 ${
                            activeTab === 'login' 
                                ? 'bg-rs-surface border border-rs-outline/50 text-rs-primary' 
                                : 'text-rs-on-surface-variant hover:text-rs-on-surface border border-transparent'
                        }`}>
                        {t('auth.login')}
                    </button>
                    <button 
                        onClick={() => setActiveTab('signup')}
                        className={`flex-1 py-2 rounded-md shadow-sm font-medium transition-all duration-200 ${
                            activeTab === 'signup' 
                                ? 'bg-rs-surface border border-rs-outline/50 text-rs-primary' 
                                : 'text-rs-on-surface-variant hover:text-rs-on-surface border border-transparent'
                        }`}>
                        {t('auth.signup')}
                    </button>
                </div>

                {errors.form && (
                    <div className="mb-4 p-3 bg-rs-error-container text-rs-error rounded-lg text-sm">
                        {errors.form}
                    </div>
                )}

                {activeTab === 'login' ? (
                    <form className="flex flex-col gap-4" onSubmit={handleLogin}>
                        {/* Email Input */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-rs-on-surface-variant pl-1" htmlFor="email">{t('auth.email')}</label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-rs-on-surface-variant/70 text-[20px]">mail</span>
                                <input 
                                    className={`w-full h-[48px] bg-rs-surface-container-lowest border ${errors.email ? 'border-rs-error' : 'border-rs-outline/50'} rounded-lg pl-10 pr-4 text-rs-on-surface placeholder:text-rs-on-surface-variant/50 focus:outline-none focus:border-rs-primary focus:ring-1 focus:ring-rs-primary transition-all duration-200`} 
                                    id="email" 
                                    type="email" 
                                    placeholder="vous@exemple.com"
                                    value={loginData.email}
                                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                                    disabled={loading}
                                />
                            </div>
                            {errors.email && <p className="text-xs text-rs-error pl-1">{errors.email}</p>}
                        </div>

                        {/* Password Input */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-rs-on-surface-variant pl-1" htmlFor="password">{t('auth.password')}</label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-rs-on-surface-variant/70 text-[20px]">lock</span>
                                <input 
                                    className={`w-full h-[48px] bg-rs-surface-container-lowest border ${errors.password ? 'border-rs-error' : 'border-rs-outline/50'} rounded-lg pl-10 pr-4 text-rs-on-surface placeholder:text-rs-on-surface-variant/50 focus:outline-none focus:border-rs-primary focus:ring-1 focus:ring-rs-primary transition-all duration-200`} 
                                    id="password" 
                                    type="password" 
                                    placeholder="••••••••"
                                    value={loginData.password}
                                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                                    disabled={loading}
                                />
                            </div>
                            {errors.password && <p className="text-xs text-rs-error pl-1">{errors.password}</p>}
                        </div>

                        {/* Forgot Password Link */}
                        <div className="flex justify-end mt-[-4px]">
                            <a className="text-xs text-rs-primary hover:text-rs-primary-fixed transition-colors duration-200" href="#">
                                Mot de passe oublié ?
                            </a>
                        </div>

                        {/* Submit Button */}
                        <button 
                            disabled={loading}
                            className="mt-2 w-full h-[48px] bg-rs-surface-tint text-rs-on-primary font-medium rounded-lg shadow-md hover:bg-rs-primary-fixed transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50" 
                            type="submit">
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    <span>{t('auth.signingIn')}</span>
                                </>
                            ) : (
                                <>
                                    <span>{t('auth.signIn')}</span>
                                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                                </>
                            )}
                        </button>
                    </form>
                ) : (
                    <form className="flex flex-col gap-4" onSubmit={handleSignup}>
                        {/* Name Input */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-rs-on-surface-variant pl-1" htmlFor="signup-name">{t('auth.fullName')}</label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-rs-on-surface-variant/70 text-[20px]">person</span>
                                <input 
                                    className={`w-full h-[48px] bg-rs-surface-container-lowest border ${errors.fullName ? 'border-rs-error' : 'border-rs-outline/50'} rounded-lg pl-10 pr-4 text-rs-on-surface placeholder:text-rs-on-surface-variant/50 focus:outline-none focus:border-rs-primary focus:ring-1 focus:ring-rs-primary transition-all duration-200`} 
                                    id="signup-name" 
                                    type="text" 
                                    placeholder="John Doe"
                                    value={signupData.fullName}
                                    onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                                    disabled={loading}
                                />
                            </div>
                            {errors.fullName && <p className="text-xs text-rs-error pl-1">{errors.fullName}</p>}
                        </div>

                        {/* Email Input */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-rs-on-surface-variant pl-1" htmlFor="signup-email">{t('auth.email')}</label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-rs-on-surface-variant/70 text-[20px]">mail</span>
                                <input 
                                    className={`w-full h-[48px] bg-rs-surface-container-lowest border ${errors.email ? 'border-rs-error' : 'border-rs-outline/50'} rounded-lg pl-10 pr-4 text-rs-on-surface placeholder:text-rs-on-surface-variant/50 focus:outline-none focus:border-rs-primary focus:ring-1 focus:ring-rs-primary transition-all duration-200`} 
                                    id="signup-email" 
                                    type="email" 
                                    placeholder="vous@exemple.com"
                                    value={signupData.email}
                                    onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                                    disabled={loading}
                                />
                            </div>
                            {errors.email && <p className="text-xs text-rs-error pl-1">{errors.email}</p>}
                        </div>

                        {/* Password Input */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-rs-on-surface-variant pl-1" htmlFor="signup-password">{t('auth.password')}</label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-rs-on-surface-variant/70 text-[20px]">lock</span>
                                <input 
                                    className={`w-full h-[48px] bg-rs-surface-container-lowest border ${errors.password ? 'border-rs-error' : 'border-rs-outline/50'} rounded-lg pl-10 pr-4 text-rs-on-surface placeholder:text-rs-on-surface-variant/50 focus:outline-none focus:border-rs-primary focus:ring-1 focus:ring-rs-primary transition-all duration-200`} 
                                    id="signup-password" 
                                    type="password" 
                                    placeholder="••••••••"
                                    value={signupData.password}
                                    onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                                    disabled={loading}
                                />
                            </div>
                            {errors.password && <p className="text-xs text-rs-error pl-1">{errors.password}</p>}
                        </div>

                        {/* Confirm Password Input */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-rs-on-surface-variant pl-1" htmlFor="signup-confirm">{t('auth.confirmPassword')}</label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-rs-on-surface-variant/70 text-[20px]">lock</span>
                                <input 
                                    className={`w-full h-[48px] bg-rs-surface-container-lowest border ${errors.confirmPassword ? 'border-rs-error' : 'border-rs-outline/50'} rounded-lg pl-10 pr-4 text-rs-on-surface placeholder:text-rs-on-surface-variant/50 focus:outline-none focus:border-rs-primary focus:ring-1 focus:ring-rs-primary transition-all duration-200`} 
                                    id="signup-confirm" 
                                    type="password" 
                                    placeholder="••••••••"
                                    value={signupData.confirmPassword}
                                    onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                                    disabled={loading}
                                />
                            </div>
                            {errors.confirmPassword && <p className="text-xs text-rs-error pl-1">{errors.confirmPassword}</p>}
                        </div>

                        {/* Submit Button */}
                        <button 
                            disabled={loading}
                            className="mt-2 w-full h-[48px] bg-rs-surface-tint text-rs-on-primary font-medium rounded-lg shadow-md hover:bg-rs-primary-fixed transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50" 
                            type="submit">
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    <span>{t('auth.creatingAccount')}</span>
                                </>
                            ) : (
                                <>
                                    <span>{t('auth.createAccount')}</span>
                                    <span className="material-symbols-outlined text-[20px]">person_add</span>
                                </>
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
