// go/basic.go
10 type User struct {
       ID string
   }
14 type Reader interface {
       Read(p []byte) (n int, err error)
   }
18 const Version = "1.0.0"
21 func NewUser(id string) *User
22 func (u *User) Name() string
