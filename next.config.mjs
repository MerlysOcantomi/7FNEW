/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["nodemailer", "imapflow", "mailparser"],
}

export default nextConfig
