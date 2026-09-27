import type { Page, Route } from "@playwright/test";

interface HorizonMockOptions {
  balance?: string;
  operationAmount?: string;
  delayMs?: number;
  failAccountPreview?: boolean;
  counters?: {
    account: number;
    transactions: number;
    operations: number;
  };
}

const recentTransaction = {
  id: "mock-tx-id",
  paging_token: "mock-paging-token",
  hash: "mock-hash",
  ledger: 1,
  created_at: new Date().toISOString(),
  source_account: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  source_account_sequence: "1",
  fee_account: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  fee_charged: "100",
  operation_count: 1,
  envelope_xdr: "",
  result_xdr: "",
  result_meta_xdr: "",
  memo_type: "none",
  signatures: [],
  valid_after: "",
  valid_before: "",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fulfillHorizon(route: Route, options: HorizonMockOptions = {}) {
  const url = route.request().url();

  if (options.delayMs) {
    await sleep(options.delayMs);
  }

  if (url.includes("/accounts/") && !url.includes("/transactions")) {
    if (options.counters) {
      options.counters.account += 1;
    }

    if (options.failAccountPreview) {
      await route.abort("timedout");
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        account_id: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        sequence: "1",
        balances: [
          { asset_type: "native", balance: options.balance ?? "1000.0000000" },
        ],
      }),
    });
    return;
  }

  if (url.includes("/transactions") && url.includes("/operations")) {
    if (options.counters) {
      options.counters.operations += 1;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        _embedded: {
          records: [
            {
              id: "mock-op-id",
              paging_token: "mock-op-paging",
              type: "payment",
              type_i: 1,
              created_at: new Date().toISOString(),
              transaction_hash: recentTransaction.hash,
              source_account: recentTransaction.source_account,
              amount: options.operationAmount ?? "100.0000000",
              asset_type: "native",
            },
          ],
        },
      }),
    });
    return;
  }

  if (url.includes("/transactions")) {
    if (options.counters) {
      options.counters.transactions += 1;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        _embedded: { records: [recentTransaction] },
        _links: {
          self: { href: url },
        },
      }),
    });
    return;
  }

  await route.continue();
}

/** Mock Horizon responses so wallet preview and indexing stay deterministic in CI. */
export async function mockWalletAndIndexer(
  page: Page,
  options: HorizonMockOptions = {},
) {
  const handler = async (route: Route) => fulfillHorizon(route, options);

  await page.route("**/horizon.stellar.org/**", handler);
  await page.route("**/horizon-testnet.stellar.org/**", handler);
}

type FreighterRequestType =
  | "REQUEST_ACCESS"
  | "REQUEST_CONNECTION_STATUS"
  | "REQUEST_NETWORK_DETAILS"
  | "REQUEST_PUBLIC_KEY"
  | "SUBMIT_TRANSACTION";

interface FreighterApiErrorShape {
  code: number;
  message: string;
}

interface MockFreighterOptions {
  address?: string;
  networkPassphrase?: string;
  rejectAccess?: boolean;
  rejectSignature?: boolean;
}

/**
 * Simulate Freighter's postMessage protocol without depending on an installed
 * browser extension.
 */
export async function mockFreighter(
  page: Page,
  options: MockFreighterOptions = {},
) {
  await page.addInitScript((mockOptions: MockFreighterOptions) => {
    const address =
      mockOptions.address ??
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
    const networkPassphrase =
      mockOptions.networkPassphrase ?? "Public Global Stellar Network ; September 2015";

    (window as Window & { freighter?: boolean }).freighter = true;

    window.addEventListener("message", (event: MessageEvent<unknown>) => {
      if (event.source !== window) return;
      if (!event.data || typeof event.data !== "object") return;

      const request = event.data as {
        source?: string;
        messageId?: number;
        type?: FreighterRequestType;
      };

      if (request.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST") return;
      if (typeof request.messageId !== "number" || !request.type) return;

      const apiError = (message: string): FreighterApiErrorShape => ({
        code: 4001,
        message,
      });

      const baseResponse = {
        source: "FREIGHTER_EXTERNAL_MSG_RESPONSE",
        messagedId: request.messageId,
      };

      switch (request.type) {
        case "REQUEST_CONNECTION_STATUS":
          window.postMessage(
            { ...baseResponse, isConnected: true },
            window.location.origin,
          );
          return;
        case "REQUEST_ACCESS":
        case "REQUEST_PUBLIC_KEY":
          window.postMessage(
            mockOptions.rejectAccess
              ? {
                  ...baseResponse,
                  publicKey: "",
                  apiError: apiError("User rejected wallet access"),
                }
              : { ...baseResponse, publicKey: address },
            window.location.origin,
          );
          return;
        case "REQUEST_NETWORK_DETAILS":
          window.postMessage(
            {
              ...baseResponse,
              networkDetails: {
                network: "PUBLIC",
                networkName: "Public",
                networkUrl: "https://horizon.stellar.org",
                networkPassphrase,
                sorobanRpcUrl: "https://mainnet.stellar.validation.stellar.org",
              },
            },
            window.location.origin,
          );
          return;
        case "SUBMIT_TRANSACTION":
          window.postMessage(
            mockOptions.rejectSignature
              ? {
                  ...baseResponse,
                  signedTransaction: "",
                  signerAddress: "",
                  apiError: apiError("User rejected transaction signature"),
                }
              : {
                  ...baseResponse,
                  signedTransaction: "signed-xdr",
                  signerAddress: address,
                },
            window.location.origin,
          );
          return;
      }
    });
  }, options);
}
