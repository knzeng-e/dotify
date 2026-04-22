export const deployments: { evm: `0x${string}` | null } = {
  evm: (import.meta.env.VITE_DOTIFY_EVM_CONTRACT as `0x${string}` | undefined) ?? null
};
