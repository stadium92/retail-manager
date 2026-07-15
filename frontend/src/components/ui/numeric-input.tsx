import * as React from "react";

import { Input } from "@/components/ui/input";

type InputProps = React.ComponentProps<typeof Input>;

interface NumericInputProps
  extends Omit<InputProps, "type" | "value" | "onChange" | "defaultValue"> {
  /** Current numeric value */
  value: number | string | undefined;
  /** Called with the parsed number on every change and on blur */
  onValueChange: (value: number) => void;
  /** Value returned when the input is empty or invalid (default: 0) */
  emptyValue?: number;
  /** Parse as integer instead of float */
  integer?: boolean;
}

const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  (
    {
      value,
      onValueChange,
      emptyValue = 0,
      integer = false,
      onFocus,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const [localValue, setLocalValue] = React.useState<string>(
      String(value ?? emptyValue),
    );
    const focusedRef = React.useRef(false);

    // Sync parent value → local display when the input is not focused
    React.useEffect(() => {
      if (!focusedRef.current) {
        setLocalValue(String(value ?? emptyValue));
      }
    }, [value, emptyValue]);

    const parse = (raw: string): number => {
      if (raw === "" || raw === "-") return emptyValue;
      const n = integer ? parseInt(raw, 10) : parseFloat(raw);
      return isNaN(n) ? emptyValue : n;
    };

    return (
      <Input
        ref={ref}
        {...props}
        type="number"
        value={localValue}
        onChange={(e) => {
          const raw = e.target.value;
          setLocalValue(raw);
          onValueChange(parse(raw));
        }}
        onFocus={(e) => {
          focusedRef.current = true;
          e.target.select();
          onFocus?.(e);
        }}
        onBlur={(e) => {
          focusedRef.current = false;
          const final = parse(localValue);
          onValueChange(final);
          setLocalValue(String(final));
          onBlur?.(e);
        }}
      />
    );
  },
);

NumericInput.displayName = "NumericInput";

export { NumericInput };
export type { NumericInputProps };
