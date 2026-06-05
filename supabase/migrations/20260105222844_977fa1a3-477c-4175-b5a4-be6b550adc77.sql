-- Create function to update current_participants count
CREATE OR REPLACE FUNCTION public.update_tournament_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  -- When a registration is confirmed, increment the count
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    UPDATE public.tournaments
    SET current_participants = COALESCE(current_participants, 0) + 1
    WHERE id = NEW.tournament_id;
  END IF;
  
  -- When a registration is cancelled/rejected from confirmed, decrement the count
  IF OLD.status = 'confirmed' AND NEW.status != 'confirmed' THEN
    UPDATE public.tournaments
    SET current_participants = GREATEST(COALESCE(current_participants, 0) - 1, 0)
    WHERE id = NEW.tournament_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on registrations table
DROP TRIGGER IF EXISTS on_registration_status_change ON public.registrations;
CREATE TRIGGER on_registration_status_change
  AFTER INSERT OR UPDATE OF status ON public.registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tournament_participant_count();