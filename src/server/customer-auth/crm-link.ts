import "server-only";

/** Email alone is not proof of ownership. A staff administrator must verify the link. */
export async function linkWebsiteCustomerToCrm(_input: {
  websiteCustomerId: string;
  email: string;
  displayName: string;
}): Promise<string | null> {
  void _input;
  return null;
}
