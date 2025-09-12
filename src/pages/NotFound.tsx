import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
    
    // If the URL contains /undefined, it's likely a navigation error
    if (location.pathname.includes('/undefined')) {
      console.error("NotFound: Detected undefined in URL, possible navigation bug");
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-grey-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-grey-600 mb-4">Oops! Page not found</p>
        <Link to="/" className="text-blue-500 hover:text-blue-700 underline">
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
