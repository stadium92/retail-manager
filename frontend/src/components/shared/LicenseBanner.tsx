import { LicenseStatus } from "@/services/LicenseService";
import { Info, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

interface LicenseBannerProps {
    status: LicenseStatus;
}

export function LicenseBanner({ status }: LicenseBannerProps) {
    const { t } = useTranslation();

    if (status.status === 'active') return null;

    const isExpired = status.status === 'expired';
    const isWarning = status.days_remaining <= 5;

    return (
        <div className={`w-full py-1.5 px-4 flex items-center justify-center gap-2 text-xs font-medium border-b transition-colors ${
            isExpired ? 'bg-red-500 text-white border-red-600' : 
            isWarning ? 'bg-amber-500 text-white border-amber-600' :
            'bg-blue-500 text-white border-blue-600'
        }`}>
            {isExpired ? (
                <>
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>Trial Expired. Please activate Retail Manager.</span>
                </>
            ) : (
                <>
                    <Info className="h-3.5 w-3.5" />
                    <span>Trial Version: {status.days_remaining} days remaining.</span>
                </>
            )}
        </div>
    );
}
