import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function Index() {
  return (
    <div className="min-h-screen bg-animated flex flex-col items-center justify-center">
      <div className="text-center space-y-8">
        {/* Logo and Title */}
        <div className="flex items-center justify-center space-x-3 mb-8">
          <div className="w-12 h-12 bg-gradient-primary rounded-lg shadow-glow-primary"></div>
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            LyfeFlow
          </h1>
        </div>

        {/* Tagline */}
        <p className="text-xl text-muted-foreground max-w-lg mx-auto">
          Smarter email. Less noise. More focus.
        </p>

        {/* Login Button */}
        <Button asChild variant="premium" size="xl" className="font-semibold">
          <Link to="/auth">
            Login
          </Link>
        </Button>
      </div>
    </div>
  );
}