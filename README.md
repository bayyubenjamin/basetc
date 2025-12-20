# BaseTC Console

**BaseTC Console** is a Web3 **mining simulation** game designed specifically as a **Farcaster Mini App** and **Frame**. This project enables users to participate in an on-chain gamified ecosystem on the Base network, featuring activities such as Rig NFT purchasing, staking, mining, and social interactions via the Farcaster protocol.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14.2-black)
![Farcaster](https://img.shields.io/badge/Farcaster-MiniApp-purple)
![Solidity](https://img.shields.io/badge/Solidity-^0.8.0-363636)

## 📋 Table of Contents

- [About the Project](#about-the-project)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Key Features](#key-features)
- [Smart Contracts](#smart-contracts)
- [Project Structure](#project-structure)
- [Installation & Development](#installation--development)

## 📖 About the Project

BaseTC Console serves as the frontend interface for interacting with the BaseTC suite of Smart Contracts. The application detects the user's environment (User Agent) to ensure access is mediated through supported clients such as Warpcast or the Base App. It integrates Web3 wallet authentication and the Farcaster social graph to provide a seamless user experience.

## 🛠 Architecture & Tech Stack

The project is built using a modern architecture that separates **Client-Side**, **Server-Side**, and **On-Chain Logic**.

### Frontend & Framework
- **Core Framework**: [Next.js 14](https://nextjs.org/) (App Router).
- **Language**: TypeScript.
- **Styling**: Tailwind CSS & PostCSS.
- **State Management**: React Query (@tanstack/react-query).

### Web3 & Blockchain Integration
- **Interaction Libraries**: [Wagmi](https://wagmi.sh/) & [Viem](https://viem.sh/) for EVM interactions.
- **Wallet Connection**: ConnectKit.
- **Smart Contract Integration**: Ethers.js.

### Farcaster Integration
- **SDK**: `@farcaster/miniapp-sdk` for Mini App integration.
- **Frames**: Backend support for Farcaster Frames (see `app/api/frame`).

### Backend & Database
- **BaaS**: [Supabase](https://supabase.com/) (PostgreSQL) for off-chain data storage and user management.
- **Edge Functions**: Supabase Edge Functions for serverless logic (e.g., `add-referral-points`, `calculate-nft-usage-points`).

## 🚀 Key Features

Based on the codebase structure, here are the system's core capabilities:

1.  **Mining Simulation**: The core mechanism where users manage "Rigs" to earn tokens.
2.  **NFT Integration**: Utilization of `RigNFT` as the primary asset within the game.
3.  **Gamification**:
    - **Merging**: Combining assets (`app/api/merge`).
    - **Spinning**: Luck-based features/draws (`SpinVault`, `app/components/Spin.tsx`).
    - **Leaderboard**: Player rankings (`app/components/Leaderboard.tsx`).
4.  **Staking**: Asset locking mechanisms for additional yields (`StakingVault`).
5.  **Social Referral**: A referral system integrated with Farcaster IDs (`ReferralClaimer`).
6.  **Environment Gating**: Automatic client detection (Warpcast, Base, Ethereum) to restrict access from bots or standard browsers.

## ⛓ Smart Contracts

The repository includes Solidity source code (`app/api/solidity/`) which forms the foundation of the on-chain logic:

| Contract | Function Description |
| :--- | :--- |
| **BaseTC.sol** | The main ERC-20 token of the ecosystem. |
| **GameCore.sol** | Primary game logic and interaction orchestration. |
| **RigNFT.sol** | ERC-721 contract for mining rig assets. |
| **RigSale.sol** | Mechanism for initial Rig sales/minting. |
| **StakingVault.sol** | Logic for staking tokens or NFTs. |
| **SpinVault.sol** | Probabilistic logic for the "Spin" feature. |
| **ReferralClaimer.sol** | On-chain referral reward distribution. |
| **TreasuryVault.sol** | Management of protocol treasury and revenue. |

## 📂 Project Structure

```bash
basetc-console/
├── app/
│   ├── api/             # API Routes (Next.js) & Solidity Contracts
│   │   ├── frame/       # Endpoints for Farcaster Frames
│   │   ├── solidity/    # Smart Contract source code
│   │   └── ...          # Other API endpoints (user, spin, merge)
│   ├── components/      # React UI Components (Leaderboard, Market, Rakit, etc.)
│   ├── context/         # React Context (Web3Provider, FarcasterProvider)
│   ├── launch/          # Main application page after loading
│   ├── lib/             # Utilities, ABIs, and client configuration
│   └── page.tsx         # Entry point with client detection logic
├── public/              # Static assets (Images, SVGs)
├── supabase/            # Supabase Configuration & Edge Functions
│   ├── functions/       # Serverless functions (Deno/TS)
│   └── config.toml
├── assets/              # Additional project assets
└── package.json         # Project dependencies
