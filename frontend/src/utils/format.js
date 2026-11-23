export const egp = (value) =>
 `${Number(value).toLocaleString('en-US', {
 minimumFractionDigits: 2,
 maximumFractionDigits: 2,
 })} EGP`
// Turns a Laravel error response into one readable string
export const errorMessage = (err, fallback = 'Something went wrong') => {
 const errors = err.response?.data?.errors
 if (errors) return Object.values(errors).flat().join(' ')
 return err.response?.data?.message || fallback
}