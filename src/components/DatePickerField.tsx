import { useState } from "react";
import { format, parse, isValid } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Nilai disimpan sebagai "yyyy-MM-dd" (date) atau "yyyy-MM-dd'T'HH:mm" (datetime). */
function parseValue(value: string, withTime: boolean): Date | undefined {
  if (!value) return undefined;
  const d = withTime
    ? parse(value.slice(0, 16), "yyyy-MM-dd'T'HH:mm", new Date())
    : parse(value.slice(0, 10), "yyyy-MM-dd", new Date());
  if (isValid(d)) return d;
  const fallback = new Date(value);
  return isValid(fallback) ? fallback : undefined;
}

export function DatePickerField({
  id,
  value,
  onChange,
  withTime = false,
  placeholder,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  withTime?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const date = parseValue(value, withTime);
  const time = withTime ? (value ? value.slice(11, 16) || "00:00" : "00:00") : "";

  const commit = (d: Date | undefined, t: string) => {
    if (!d) {
      onChange("");
      return;
    }
    onChange(
      withTime
        ? `${format(d, "yyyy-MM-dd")}T${t || "00:00"}`
        : format(d, "yyyy-MM-dd"),
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            "h-10 w-full justify-start rounded-xl text-left font-normal",
            !date && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {date
            ? format(date, withTime ? "dd MMM yyyy HH:mm" : "dd MMM yyyy", {
                locale: idLocale,
              })
            : (placeholder ?? (withTime ? "Pilih tanggal & jam" : "Pilih tanggal"))}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          {...(date ? { defaultMonth: date } : {})}
          locale={idLocale}
          onSelect={(d) => {
            commit(d ?? undefined, time);
            if (!withTime) setOpen(false);
          }}
          className={cn("p-3 pointer-events-auto")}
        />
        {withTime && (
          <div className="flex items-center gap-2 border-t border-border p-3">
            <span className="text-sm text-muted-foreground">Jam</span>
            <Input
              type="time"
              value={time}
              className="h-9 w-32"
              onChange={(e) => commit(date ?? new Date(), e.target.value)}
            />
            <Button size="sm" className="ml-auto" onClick={() => setOpen(false)}>
              Selesai
            </Button>
          </div>
        )}
        {!withTime && value && (
          <div className="border-t border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Kosongkan
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default DatePickerField;
