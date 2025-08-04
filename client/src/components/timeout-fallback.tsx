import { RefreshCw, Smartphone } from "lucide-react";

/**
 * Fallback component shown when authentication times out
 * Primarily designed for iOS Safari issues with Clerk authentication
 */
export function TimeoutFallback() {
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  
  const handleRefresh = () => {
    window.location.reload();
  };
  
  const handleDesktopRedirect = () => {
    // Copy current URL to clipboard if possible
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).catch(() => {
        // Ignore clipboard errors
      });
    }
  };
  
  return (
    <div className="flex h-screen bg-gray-50">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md p-6">
          <div className="mb-6">
            <Smartphone className="h-16 w-16 mx-auto text-gray-400" />
          </div>
          
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Taking longer than expected
          </h2>
          
          <p className="text-gray-600 mb-6">
            {isIOS 
              ? "We're experiencing issues with iOS Safari. For the best experience, please use a desktop computer."
              : "Authentication is taking longer than usual. Please try refreshing the page."
            }
          </p>
          
          <div className="space-y-3">
            <button 
              onClick={handleRefresh}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Page
            </button>
            
            {isIOS && (
              <div className="text-sm text-gray-500">
                <p>💡 <strong>Tip:</strong> Try opening this page in Safari's private mode or use a desktop computer for the best experience.</p>
              </div>
            )}
          </div>
          
          <div className="mt-6 text-xs text-gray-400">
            If this problem persists, please contact support.
          </div>
        </div>
      </div>
    </div>
  );
} 