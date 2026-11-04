import { RedeemLink } from "./redeem-link";

export default async function SignInLinkPage({ params }: PageProps<"/app/a/[code]">) {
  const { code } = await params;
  return <RedeemLink code={code} />;
}
