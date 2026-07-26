export default {
  domain: 'dotify.dot',
  displayName: 'Dotify',
  description: 'Shared musical presence with artist-owned access and value flows.',
  icon: {
    path: './product-icon.png',
    format: 'png'
  },
  executables: [
    {
      kind: 'app',
      path: './dist-product',
      appVersion: [0, 1, 0]
    }
  ]
};
