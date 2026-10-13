CREATE OR REPLACE FUNCTION fn_gemelotur_persistence_health()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_destinos BIGINT;
  v_packages BIGINT;
  v_escenarios BIGINT;
  v_runs BIGINT;
  v_zonas BIGINT;
  v_rls BOOLEAN;
BEGIN
  SELECT count(*) INTO v_destinos FROM destinos;
  SELECT count(*) INTO v_packages FROM context_packages;
  SELECT count(*) INTO v_escenarios FROM escenarios_definiciones;
  SELECT count(*) INTO v_runs FROM simulation_runs;
  SELECT count(*) INTO v_zonas FROM zonas_destino;

  SELECT relrowsecurity INTO v_rls
  FROM pg_class
  WHERE relname = 'context_packages' AND relnamespace = 'public'::regnamespace;

  RETURN jsonb_build_object(
    'destinos', v_destinos,
    'contextPackages', v_packages,
    'escenarios', v_escenarios,
    'simulationRuns', v_runs,
    'zonas', v_zonas,
    'rlsEnabled', COALESCE(v_rls, false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_gemelotur_persistence_health() TO gemelotur_app;
