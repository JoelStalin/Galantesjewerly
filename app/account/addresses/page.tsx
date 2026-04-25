import { AddressBook } from '@/components/account/AddressBook';

export const metadata = {
  title: 'Address Book - Galante\'s Jewelry',
};

export default function AddressesPage() {
  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="border-b border-primary/10 pb-6">
        <h1 className="font-serif text-4xl text-primary">Address Book</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your shipping and billing locations for a seamless checkout experience.</p>
      </div>

      <AddressBook />
    </div>
  );
}
