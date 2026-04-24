const embeddedEvmDeployment = '0x17623c6df0e9cb06bf64364588ebb057b0ea43c6' as `0x${string}` | null;
const envEvmDeployment = import.meta.env.VITE_DOTIFY_EVM_CONTRACT as `0x${string}` | undefined;

export const deployments: { evm: `0x${string}` | null } = {
  evm: envEvmDeployment ?? embeddedEvmDeployment
};
