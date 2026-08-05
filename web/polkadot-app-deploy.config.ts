export default {
  domain: 'dotify-test01.dot',
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
      appVersion: [0, 1, 4]
    }
  ]
};
