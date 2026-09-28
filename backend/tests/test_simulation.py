import pytest
from app.services.simulation import forecast, risk_level

def test_reproducible_monte_carlo():
    assert forecast(7, 1000, 42) == forecast(7, 1000, 42)

def test_delay_shifts_shipment_and_inventory():
    a, b = forecast(0, 100, 1), forecast(30, 100, 1)
    assert b["assumptions"]["projected_arrival_day"] == a["assumptions"]["projected_arrival_day"] + 30
    assert a["deterministic"]["series"][70]["liters"] > b["deterministic"]["series"][70]["liters"]

def test_probabilities_are_bounded_and_trials_accounted():
    result = forecast(15, 1000, 26062)
    mc = result["monte_carlo"]
    assert 0 <= mc["shortfall_probability"] <= 1
    assert mc["stockout_count"] + mc["no_stockout_count"] == 1000
    assert len(mc["trial_stockout_days"]) == 1000

def test_zero_stockouts_are_censored_not_given_fake_dates():
    from app.services.simulation import Assumptions
    result = forecast(0, 100, 2, assumptions=Assumptions(initial_liters=1_000_000, daily_liters=100, shipment_liters=100_000))
    assert result["monte_carlo"]["stockout_count"] == 0
    assert result["monte_carlo"]["stockout_day_percentiles"] is None
    assert all(day is None for day in result["monte_carlo"]["trial_stockout_days"])

@pytest.mark.parametrize("kwargs", [{"delay_days":31},{"trials":99},{"demand_reduction":.5},{"airlift_liters":20001}])
def test_invalid_inputs(kwargs):
    with pytest.raises(ValueError): forecast(**kwargs)

def test_hypothetical_actions_affect_forecast():
    baseline=forecast(30,1000,26062)
    airlift=forecast(30,1000,26062,airlift_liters=20000)
    conserve=forecast(30,1000,26062,demand_reduction=.2)
    assert airlift["monte_carlo"]["shortfall_probability"] <= baseline["monte_carlo"]["shortfall_probability"]
    assert conserve["deterministic"]["days_of_fuel"] > baseline["deterministic"]["days_of_fuel"]

def test_risk_classification_boundaries():
    assert risk_level(0)=="LOW"
    assert risk_level(.25)=="ELEVATED"
    assert risk_level(.6)=="CRITICAL"
