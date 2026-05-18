package main

import "fmt"
import (
    alias "example.com/pkg"
    _ "net/http"
)

// User is a sample type.
type User struct {
    ID string
}

type Reader interface {
    Read(p []byte) (n int, err error)
}

const Version = "1.0.0"
var cache = map[string]int{}

func NewUser(id string) *User { return &User{ID: id} }
func (u *User) Name() string { return u.ID }
