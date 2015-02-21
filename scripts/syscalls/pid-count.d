#!/usr/sbin/dtrace -s
BEGIN {
	printf("tracing, ctrl-c to exit...\n");
}
syscall:::entry
/$target == pid/
{
	@[execname, probefunc] = count();
}
