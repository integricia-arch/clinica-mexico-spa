import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SubscriptionGateBanner } from "./SubscriptionGateBanner";

describe("SubscriptionGateBanner", () => {
  it("no renderiza nada si subscription_status es active", () => {
    const { container } = render(
      <SubscriptionGateBanner clinic={{ subscription_status: "active", grace_period_ends_at: null }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("muestra aviso con fecha límite si subscription_status es past_due en gracia", () => {
    render(
      <SubscriptionGateBanner
        clinic={{ subscription_status: "past_due", grace_period_ends_at: "2026-08-01T00:00:00Z" }}
      />,
    );
    expect(screen.getByText(/pago pendiente/i)).toBeInTheDocument();
  });
});
