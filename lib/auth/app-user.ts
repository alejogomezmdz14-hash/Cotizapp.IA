export type AppUser = {
  /** UUID interno del perfil en Supabase (user_id en tablas). */
  id: string;
  clerkId: string;
  email: string | null;
};
