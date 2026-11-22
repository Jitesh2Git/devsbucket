"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// Back to the page before, like the browser's back button.
const GoBackButton = () => {
  return (
    <Button variant="outline" onClick={() => window.history.back()}>
      <ArrowLeft />
      Go back
    </Button>
  );
};

export default GoBackButton;
