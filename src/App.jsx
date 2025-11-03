import { useState } from "react";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import "./App.css";

// Configuration
const CONTRACT_ADDRESS = "0xab02bf85a7a851b6a379ea3d5bd3b9b4f5dd8461";
const START_BLOCK = 21280000n;

const CONTRACT_ABI = [
  {
    type: "function",
    name: "entityByAddress",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bytes16" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "entityStateByID",
    inputs: [{ name: "", type: "bytes16" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "addr", type: "address" },
          { name: "entityID", type: "bytes16" },
          { name: "acceptedAmount", type: "uint64" },
          { name: "bidTimestamp", type: "uint32" },
          { name: "refunded", type: "bool" },
          { name: "cancelled", type: "bool" },
          {
            name: "activeBid",
            type: "tuple",
            components: [
              { name: "amount", type: "uint64" },
              { name: "timestamp", type: "uint32" },
            ],
          },
        ],
      },
    ],
    stateMutability: "view",
  },
];

// Create client
const client = createPublicClient({
  chain: mainnet,
  transport: http("https://ethereum-rpc.publicnode.com"),
});

function App() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  const checkAllocations = async () => {
    if (!address) {
      setError("Please enter an address or ENS name");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setProgress("");

    try {
      let resolvedAddress = address;

      // Check if input is an ENS name (contains .eth or doesn't start with 0x)
      if (!address.startsWith("0x") || address.endsWith(".eth")) {
        setProgress("🔍 Resolving ENS name...");
        try {
          resolvedAddress = await client.getEnsAddress({
            name: address,
          });

          if (!resolvedAddress) {
            setError("ENS name not found or not resolved");
            setLoading(false);
            setProgress("");
            return;
          }
        } catch (ensError) {
          setError(`Failed to resolve ENS name: ${ensError.message}`);
          setLoading(false);
          setProgress("");
          return;
        }
      } else {
        // Basic address validation for regular addresses
        if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
          setError("Invalid Ethereum address format");
          setLoading(false);
          setProgress("");
          return;
        }
      }

      // Get entityID for the user address
      setProgress("📡 Fetching entityID...");
      const entityID = await client.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "entityByAddress",
        args: [resolvedAddress],
      });

      // Get entity state by ID
      setProgress("� Fetching allocation data...");
      const entityState = await client.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "entityStateByID",
        args: [entityID],
      });

      // Extract allocation amount (acceptedAmount is in USDT with 6 decimals)
      const acceptedAmount = Number(entityState.acceptedAmount);
      const amountUSDT = acceptedAmount / 1e6;

      if (acceptedAmount === 0) {
        setResult({
          found: false,
          message: "No allocation detected",
          entityID: entityID,
        });
      } else {
        setResult({
          found: true,
          amount: amountUSDT,
          entityID: entityID,
          refunded: entityState.refunded,
          cancelled: entityState.cancelled,
          bidTimestamp: entityState.bidTimestamp,
        });
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      checkAllocations();
    }
  };

  return (
    <div className="app">
      <div className="container">
        <h1>🔍 MegaETH Allocation Checker</h1>
        <p className="subtitle">
          Check your MegaETH allocation status on Ethereum
        </p>

        <div className="input-section">
          <input
            type="text"
            placeholder="Enter your Ethereum address or ENS name (vitalik.eth)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
            className="address-input"
          />
          <button
            onClick={checkAllocations}
            disabled={loading}
            className="check-button"
          >
            {loading ? "⏳ Checking..." : "🔍 Check Allocation"}
          </button>
        </div>

        {progress && <div className="progress">{progress}</div>}

        {error && <div className="error">❌ {error}</div>}

        {result && (
          <div className={`result ${result.found ? "success" : "no-result"}`}>
            {result.found ? (
              <>
                <h2>🎉 Allocation Found!</h2>
                <div className="result-details">
                  <div className="detail-item">
                    <span className="label">💰 Amount:</span>
                    <span className="value">
                      {result.amount.toLocaleString()} USDT
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="label">🆔 Entity ID:</span>
                    <span className="value small">{result.entityID}</span>
                  </div>
                  {result.refunded && (
                    <div className="detail-item">
                      <span className="label">⚠️ Status:</span>
                      <span className="value">Refunded</span>
                    </div>
                  )}
                  {result.cancelled && (
                    <div className="detail-item">
                      <span className="label">⚠️ Status:</span>
                      <span className="value">Cancelled</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <h2>❌ No Allocation Detected</h2>
                <p>No allocation found for this address.</p>
                {result.entityID && (
                  <div className="result-details">
                    <div className="detail-item">
                      <span className="label">🆔 Entity ID:</span>
                      <span className="value small">{result.entityID}</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="footer">
          <p>
            Contract: <code>{CONTRACT_ADDRESS}</code>
          </p>
          <p>Scanning from block {START_BLOCK.toString()}</p>
        </div>
      </div>
    </div>
  );
}

export default App;
