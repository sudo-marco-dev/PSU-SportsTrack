import { Check } from "lucide-react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { cn } from "@/lib/utils"

function Checkbox({
  className,
  disabled,
  ...props
}: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      disabled={disabled}
      aria-disabled={disabled ? true : undefined}
      className={cn(
        "peer inline-flex size-5 min-w-[20px] min-h-[20px] shrink-0 items-center justify-center rounded-md border-2 border-slate-400 dark:border-slate-400 bg-slate-900/95 text-white shadow-sm ring-1 ring-white/15 transition-all cursor-pointer hover:border-orange-400 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-45 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45 data-[checked]:border-orange-500 data-[checked]:bg-orange-500 data-[checked]:text-white data-[state=checked]:border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:text-white",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white">
        <Check className="size-3.5 stroke-[3.5]" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
