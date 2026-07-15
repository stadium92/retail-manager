import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import logoUrl from '@/assets/logo.png';

interface MobileAuthProps {
  loginData: any;
  setLoginData: any;
  handleLogin: (e: React.FormEvent) => void;
  loading: boolean;
  errors: any;
}

export function MobileAuth({ loginData, setLoginData, handleLogin, loading, errors }: MobileAuthProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-[#18120a] text-[#ede1d3] min-h-screen flex flex-col items-center justify-center px-4 py-6 overflow-y-auto dark">
      {/* Header Section */}
      <div className="flex flex-col items-center mb-6 w-full max-w-sm">
        <div className="w-24 h-24 mb-6 rounded-2xl overflow-hidden shadow-2xl border border-[#514534]/20 bg-[#251f16] flex items-center justify-center relative group">
          <div className="absolute inset-0 bg-gradient-to-tr from-[#ffba41]/10 to-transparent opacity-50"></div>
          <img alt="DJATI Logo" className="w-full h-full object-contain z-10 relative" src={logoUrl} />
        </div>
        <h1 className="font-bold text-2xl text-[#ede1d3] mb-2 tracking-tight uppercase">DJATI</h1>
        <p className="text-[15px] text-[#d5c4ae] text-center max-w-[280px]">
          Votre plateforme intelligente de gestion de commandes au détail
        </p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm bg-[#251f16] rounded-2xl p-5 shadow-2xl border border-[#9e8e7a]/30 relative overflow-hidden">
        {/* Segmented Control */}
        <div className="flex bg-[#3b342a] rounded-lg p-1 mb-5 border border-[#9e8e7a]/20">
          <button className="flex-1 py-2 bg-[#18120a] rounded-md shadow-sm border border-[#9e8e7a]/50 font-medium text-[17px] text-[#ffba41] transition-all duration-200">
            Connexion
          </button>
          <button className="flex-1 py-2 font-medium text-[17px] text-[#d5c4ae] hover:text-[#ede1d3] transition-colors duration-200">
            S'inscrire
          </button>
        </div>

        <form className="flex flex-col gap-3" onSubmit={handleLogin}>
          {/* Email Input */}
          <div className="flex flex-col gap-1">
            <label className="text-[13px] text-[#d5c4ae] pl-1" htmlFor="email">Email</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#d5c4ae]/70 text-[20px]">mail</span>
              <input 
                className="w-full h-[48px] bg-[#130d06] border border-[#9e8e7a] rounded-lg pl-10 pr-4 text-[15px] text-[#ede1d3] placeholder:text-[#d5c4ae]/50 focus:outline-none focus:border-[#ffba41] focus:ring-1 focus:ring-[#ffba41] transition-all duration-200" 
                id="email" 
                placeholder="vous@exemple.com" 
                type="email"
                value={loginData.email}
                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                disabled={loading}
              />
            </div>
            {errors.email && <p className="text-sm text-[#ffb4ab] pl-1">{errors.email}</p>}
          </div>

          {/* Password Input */}
          <div className="flex flex-col gap-1">
            <label className="text-[13px] text-[#d5c4ae] pl-1" htmlFor="password">Mot de passe</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#d5c4ae]/70 text-[20px]">lock</span>
              <input 
                className="w-full h-[48px] bg-[#130d06] border border-[#9e8e7a] rounded-lg pl-10 pr-4 text-[15px] text-[#ede1d3] placeholder:text-[#d5c4ae]/50 focus:outline-none focus:border-[#ffba41] focus:ring-1 focus:ring-[#ffba41] transition-all duration-200" 
                id="password" 
                placeholder="••••••••" 
                type="password"
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                disabled={loading}
              />
            </div>
            {errors.password && <p className="text-sm text-[#ffb4ab] pl-1">{errors.password}</p>}
          </div>

          {/* Forgot Password Link */}
          <div className="flex justify-end mt-[-4px]">
            <a className="text-[13px] text-[#ffba41] hover:text-[#ffddaf] transition-colors duration-200" href="#">
              Mot de passe oublié ?
            </a>
          </div>

          {errors.form && <p className="text-sm text-[#ffb4ab]">{errors.form}</p>}

          {/* Submit Button */}
          <button 
            className="mt-2 w-full h-[48px] bg-[#ffba41] text-[#432c00] font-medium text-[17px] rounded-lg shadow-md hover:bg-[#ffddaf] transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2" 
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>Se connecter</span>
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
