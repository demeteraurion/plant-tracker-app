import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export function useSupabaseAuth() {
  const [session, setSession] = useState(null);

  const user = session?.user ?? null;

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isAuthBusy, setIsAuthBusy] = useState(false);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) {
        console.error("Failed to get session", error);
        return;
      }
      setSession(data?.session ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const openAuthModal = () => {
    setIsAuthModalOpen(true);
    setAuthMessage("");
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setAuthMessage("");
  };

  const sendMagicLink = async () => {
    const email = authEmail.trim();
    if (!email) return;

    setIsAuthBusy(true);
    setAuthMessage("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setAuthMessage("Check your email for a sign-in link ✨");
    } catch (e) {
      console.error("Failed to send magic link", e);
      setAuthMessage("Could not send sign-in link. Double-check the email and try again.");
    } finally {
      setIsAuthBusy(false);
    }
  };

  const signOut = async () => {
    setIsAuthBusy(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setAuthMessage("");
      setAuthEmail("");
    } catch (e) {
      console.error("Failed to sign out", e);
    } finally {
      setIsAuthBusy(false);
    }
  };

  return {
    // state
    session,
    user,

    // modal/ui state
    isAuthModalOpen,
    authEmail,
    authMessage,
    isAuthBusy,

    // setters (for the modal input)
    setAuthEmail,
    setAuthMessage,

    // actions
    openAuthModal,
    closeAuthModal,
    sendMagicLink,
    signOut,
  };
}
