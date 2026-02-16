import { ReactNode } from "react";

interface POSLayoutProps {
    children: ReactNode;
}

export function POSLayout({ children }: POSLayoutProps) {
    return (
        <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
            {/* Small Header for Connectivity Status & User Info */}
            <header className="h-12 border-b flex items-center px-4 bg-card shrink-0 justify-between">
                <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
                    <span className="text-primary">Retail</span>Manager
                    <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">POS</span>
                </div>

                <div className="flex items-center gap-4 text-sm">
                    {/* Add connectivity indicator here later */}
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span>Online</span>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-hidden relative">
                {children}
            </main>
        </div>
    );
}
