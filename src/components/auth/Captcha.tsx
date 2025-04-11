
import { useState } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface CaptchaProps {
  onVerify: (verified: boolean) => void;
}

const Captcha = ({ onVerify }: CaptchaProps) => {
  const [checked, setChecked] = useState(false);

  const handleChange = (checked: boolean) => {
    setChecked(checked);
    onVerify(checked);
  };

  return (
    <div className="flex items-center space-x-2 p-4 border border-white/10 rounded-md bg-secondary/30 backdrop-blur-sm">
      <Checkbox 
        id="captcha" 
        checked={checked} 
        onCheckedChange={handleChange}
        className="data-[state=checked]:bg-accent"
      />
      <Label htmlFor="captcha" className="text-sm font-medium leading-none">
        Eu não sou um robô
      </Label>
    </div>
  );
};

export default Captcha;
