import { useState } from "react";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import "./App.css";

// Configuration
const CONTRACT_ADDRESS = "0xab02bf85a7a851b6a379ea3d5bd3b9b4f5dd8461";
const START_BLOCK = 21280000n;

const CONTRACT_ABI = [
  {
    type: "event",
    name: "AllocationSet",
    inputs: [
      { name: "entityID", type: "bytes16", indexed: true },
      { name: "acceptedAmountUSDT", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "entityByAddress",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bytes16" }],
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
      setError("Please enter an address");
      return;
    }

    // Basic address validation
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError("Invalid Ethereum address format");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setProgress("");

    try {
      // Get current block
      setProgress("📦 Getting current block...");
      const currentBlock = await client.getBlockNumber();

      // Get entityID for the user address
      setProgress("📡 Fetching entityID...");
      const entityID = await client.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "entityByAddress",
        args: [address],
      });

      // Scan in chunks to avoid RPC limits (50k blocks max)
      setProgress(
        `🔄 Scanning blocks from ${START_BLOCK} to ${currentBlock}...`
      );

      const allLogs = [];
      const CHUNK_SIZE = 50000n;

      for (
        let fromBlock = START_BLOCK;
        fromBlock <= currentBlock;
        fromBlock += CHUNK_SIZE
      ) {
        const toBlock =
          fromBlock + CHUNK_SIZE - 1n > currentBlock
            ? currentBlock
            : fromBlock + CHUNK_SIZE - 1n;

        setProgress(`📦 Scanning blocks ${fromBlock} to ${toBlock}...`);

        const logs = await client.getLogs({
          address: CONTRACT_ADDRESS,
          event: {
            type: "event",
            name: "AllocationSet",
            inputs: [
              { name: "entityID", type: "bytes16", indexed: true },
              { name: "acceptedAmountUSDT", type: "uint256", indexed: false },
            ],
          },
          fromBlock,
          toBlock,
        });

        allLogs.push(...logs);
      }

      // Filter events for our entityID
      const userAllocations = allLogs.filter(
        (log) => log.args.entityID.toLowerCase() === entityID.toLowerCase()
      );

      if (userAllocations.length === 0) {
        setResult({
          found: false,
          message: "No allocation detected",
          entityID: entityID,
        });
      } else {
        // Show the latest allocation
        const latestAlloc = userAllocations[userAllocations.length - 1];
        const amountUSDT = Number(latestAlloc.args.acceptedAmountUSDT) / 1e6;

        setResult({
          found: true,
          amount: amountUSDT,
          transactionHash: latestAlloc.transactionHash,
          blockNumber: latestAlloc.blockNumber.toString(),
          totalAllocations: userAllocations.length,
          entityID: entityID,
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
            placeholder="Enter your Ethereum address (0x...)"
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
                    <span className="label">🔗 Transaction:</span>
                    <a
                      href={`https://etherscan.io/tx/${result.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link"
                    >
                      {result.transactionHash.slice(0, 10)}...
                      {result.transactionHash.slice(-8)}
                    </a>
                  </div>
                  <div className="detail-item">
                    <span className="label">📦 Block:</span>
                    <span className="value">{result.blockNumber}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">📊 Total Allocations:</span>
                    <span className="value">{result.totalAllocations}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">🆔 Entity ID:</span>
                    <span className="value small">{result.entityID}</span>
                  </div>
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
