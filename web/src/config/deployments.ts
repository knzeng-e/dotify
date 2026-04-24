const embeddedEvmDeployment = '0x0ec28770d8e8d9ee762e7d6fedd6c70df495be51' as `0x${string}` | null;
const envEvmDeployment = import.meta.env.VITE_DOTIFY_EVM_CONTRACT as `0x${string}` | undefined;

export const deployments: { evm: `0x${string}` | null } = {
  evm: envEvmDeployment ?? embeddedEvmDeployment
};
