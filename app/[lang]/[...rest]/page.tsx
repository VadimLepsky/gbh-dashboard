import { notFound } from 'next/navigation'

/** Unknown paths render the localized 404 inside the layout (shell, language) instead of the bare default one. */
export default function CatchAll() {
  notFound()
}
