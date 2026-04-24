import type { FC } from "hono/jsx";

type FormErrorProps = {
  id: string;
};

export const FormError: FC<FormErrorProps> = ({ id }) => (
  <div id={id} class="text-red-400 text-sm mt-2 min-h-[1.25rem]" />
);
