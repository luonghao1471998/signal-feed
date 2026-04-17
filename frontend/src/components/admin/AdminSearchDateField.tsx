import { format, parse } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface AdminSearchDateFieldProps {
  value: string;
  onChange: (isoDate: string) => void;
  placeholder: string;
  id?: string;
}

function parseYmd(value: string): Date | undefined {
  if (!value) return undefined;
  try {
    return parse(value, "yyyy-MM-dd", new Date());
  } catch {
    return undefined;
  }
}

const AdminSearchDateField: React.FC<AdminSearchDateFieldProps> = ({ value, onChange, placeholder, id }) => {
  const selected = parseYmd(value);
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn("w-full justify-start border-slate-300 bg-white text-left font-normal", !value && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {value ? format(selected ?? new Date(), "yyyy-MM-dd") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            onChange(date ? format(date, "yyyy-MM-dd") : "");
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
};

export default AdminSearchDateField;
